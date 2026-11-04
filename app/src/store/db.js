/*
 * Wrapper IndexedDB minimale, basato su Promise.
 * Database "nexuslife":
 *  - records  chiave [entity, id], indici entity e updatedAt
 *  - outbox   coda di sincronizzazione, chiave "entity:id" (più modifiche allo stesso record = una voce)
 *  - meta     cursori, flag e chiavi, chiave "key"
 * Ogni modifica allo schema incrementa DB_VERSION e aggiunge una migrazione esplicita.
 */

export const DB_NAME = 'nexuslife';
export const DB_VERSION = 1;

/** Migrazioni: la funzione di indice N porta lo schema dalla versione N−1 alla N. */
export const MIGRATIONS = {
  1(db) {
    const records = db.createObjectStore('records', { keyPath: ['entity', 'id'] });
    records.createIndex('entity', 'entity', { unique: false });
    records.createIndex('updatedAt', 'updatedAt', { unique: false });
    db.createObjectStore('outbox', { keyPath: 'key' });
    db.createObjectStore('meta', { keyPath: 'key' });
  },
};

/** Promise da una IDBRequest. */
export function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error('Transazione annullata'));
    tx.onerror = () => reject(tx.error);
  });
}

/** Apre (e se serve migra) il database. */
export function openDatabase(name = DB_NAME, idb = globalThis.indexedDB) {
  if (!idb) return Promise.reject(new Error('IndexedDB non disponibile'));
  return new Promise((resolve, reject) => {
    const req = idb.open(name, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      for (let v = event.oldVersion + 1; v <= DB_VERSION; v++) MIGRATIONS[v](db, req.transaction);
    };
    req.onsuccess = () => {
      const db = req.result;
      // un'altra scheda con una versione più nuova chiede di aggiornare: chiudiamo
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database bloccato da un\'altra scheda aperta'));
  });
}

/**
 * Adattatore usato da repo.js. Stessa interfaccia dell'adattatore in memoria dei test.
 * @param {IDBDatabase} db
 */
export function createIdbAdapter(db) {
  const store = (name, mode = 'readonly') => db.transaction(name, mode).objectStore(name);

  return {
    async get(entity, id) {
      return (await promisify(store('records').get([entity, id]))) ?? null;
    },
    listByEntity(entity) {
      return promisify(store('records').index('entity').getAll(entity));
    },
    listAll() {
      return promisify(store('records').getAll());
    },
    /** Scrive i record e le voci di outbox nella stessa transazione. */
    async commit(records, outboxEntries = []) {
      const tx = db.transaction(['records', 'outbox'], 'readwrite');
      const rs = tx.objectStore('records');
      const os = tx.objectStore('outbox');
      for (const r of records) rs.put(r);
      for (const e of outboxEntries) os.put(e);
      await done(tx);
    },
    async remove(keys) {
      const tx = db.transaction('records', 'readwrite');
      const rs = tx.objectStore('records');
      for (const [entity, id] of keys) rs.delete([entity, id]);
      await done(tx);
    },
    outboxList() {
      return promisify(store('outbox').getAll());
    },
    /**
     * Conferma l'invio: rimuove le voci solo se non sono cambiate nel frattempo
     * (stesso updatedAt), così una modifica fatta durante la sync resta in coda.
     */
    async outboxAck(entries) {
      const tx = db.transaction('outbox', 'readwrite');
      const os = tx.objectStore('outbox');
      for (const e of entries) {
        const req = os.get(e.key);
        req.onsuccess = () => {
          if (req.result && req.result.updatedAt === e.updatedAt) os.delete(e.key);
        };
      }
      await done(tx);
    },
    close() {
      db.close();
    },
    async metaGet(key) {
      return (await promisify(store('meta').get(key)))?.value;
    },
    async metaSet(key, value) {
      const tx = db.transaction('meta', 'readwrite');
      tx.objectStore('meta').put({ key, value });
      await done(tx);
    },
  };
}

/** Apre il database e restituisce l'adattatore. */
export async function openIdbAdapter() {
  return createIdbAdapter(await openDatabase());
}
