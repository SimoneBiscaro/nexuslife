/*
 * IndexedDB finto, solo per provare le migrazioni di schema in Node: riproduce open(name, version),
 * l'evento upgradeneeded con oldVersion, la creazione di store e indici e i dati per store
 * (conservati tra un'apertura e l'altra). Non implementa transazioni né query.
 */
export function createFakeIndexedDB() {
  const databases = new Map(); // name → { version, stores: Map(name → { keyPath, indexes: Map, rows: Map }) }

  function makeStoreHandle(store) {
    return {
      get keyPath() { return store.keyPath; },
      get indexNames() { return [...store.indexes.keys()]; },
      createIndex(name, keyPath, opts = {}) {
        if (store.indexes.has(name)) throw new DOMException(`Indice ${name} già esistente`, 'ConstraintError');
        store.indexes.set(name, { keyPath, unique: Boolean(opts.unique) });
      },
      deleteIndex(name) { store.indexes.delete(name); },
      put(value) {
        const key = Array.isArray(store.keyPath) ? store.keyPath.map((k) => value[k]) : value[store.keyPath];
        store.rows.set(JSON.stringify(key), structuredClone(value));
      },
    };
  }

  function makeDb(name, entry, upgrading) {
    return {
      name,
      get version() { return entry.version; },
      objectStoreNames: { contains: (n) => entry.stores.has(n), get length() { return entry.stores.size; }, [Symbol.iterator]: () => entry.stores.keys() },
      createObjectStore(storeName, opts = {}) {
        if (!upgrading.active) throw new DOMException('Fuori da upgradeneeded', 'InvalidStateError');
        if (entry.stores.has(storeName)) throw new DOMException(`Store ${storeName} già esistente`, 'ConstraintError');
        const store = { keyPath: opts.keyPath, indexes: new Map(), rows: new Map() };
        entry.stores.set(storeName, store);
        return makeStoreHandle(store);
      },
      deleteObjectStore(storeName) { entry.stores.delete(storeName); },
      close() {},
      onversionchange: null,
    };
  }

  return {
    databases,
    /** Schema leggibile per i confronti nei test. */
    schema(name) {
      const entry = databases.get(name);
      return Object.fromEntries([...entry.stores].map(([s, st]) => [s, {
        keyPath: st.keyPath,
        indexes: Object.fromEntries([...st.indexes].map(([i, d]) => [i, d.keyPath])),
      }]));
    },
    rows(name, store) { return [...databases.get(name).stores.get(store).rows.values()]; },
    open(name, version) {
      const req = { result: null, error: null, transaction: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
      queueMicrotask(() => {
        let entry = databases.get(name);
        const oldVersion = entry?.version ?? 0;
        if (version < oldVersion) {
          req.error = new DOMException('La versione richiesta è più vecchia di quella esistente', 'VersionError');
          req.onerror?.({ target: req });
          return;
        }
        if (!entry) { entry = { version: 0, stores: new Map() }; databases.set(name, entry); }
        const upgrading = { active: false };
        const db = makeDb(name, entry, upgrading);
        req.result = db;
        if (version > oldVersion) {
          upgrading.active = true;
          req.transaction = { objectStore: (s) => makeStoreHandle(entry.stores.get(s)) };
          entry.version = version;
          try {
            req.onupgradeneeded?.({ oldVersion, newVersion: version, target: req });
          } catch (err) {
            entry.version = oldVersion;
            req.error = err;
            req.onerror?.({ target: req });
            return;
          } finally {
            upgrading.active = false;
          }
        }
        req.onsuccess?.({ target: req });
      });
      return req;
    },
  };
}
