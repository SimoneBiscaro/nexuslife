import { notifyChange } from './state.js';
import { openIdbAdapter } from './db.js';

/** Le tombstone vengono eliminate davvero dopo 180 giorni. */
export const TOMBSTONE_TTL_DAYS = 180;
const DAY_MS = 86_400_000;
const SYSTEM_FIELDS = ['id', 'entity', 'createdAt'];

const outboxEntry = (r) => ({ key: `${r.entity}:${r.id}`, entity: r.entity, id: r.id, updatedAt: r.updatedAt });

/**
 * Repository dei record: CRUD con tombstone, updatedAt automatico, coda di sync.
 * @param {object} adapter adattatore di persistenza (IndexedDB o in memoria)
 * @param {{ clock?: () => Date, uuid?: () => string }} [opts]
 */
export function createRepo(adapter, { clock = () => new Date(), uuid = () => crypto.randomUUID() } = {}) {
  let lastStamp = 0;

  /** Istante ISO strettamente crescente (e successivo a `after`, se dato). */
  function stamp(after) {
    let t = clock().getTime();
    const floor = Math.max(lastStamp, after ? Date.parse(after) : 0);
    if (t <= floor) t = floor + 1;
    lastStamp = t;
    return new Date(t).toISOString();
  }

  async function commit(records, { queue = true } = {}) {
    if (!records.length) return records;
    await adapter.commit(records, queue ? records.map(outboxEntry) : []);
    notifyChange(records.map((r) => r.entity));
    return records;
  }

  async function get(entity, id, { includeDeleted = false } = {}) {
    const r = await adapter.get(entity, id);
    return r && (includeDeleted || !r.deleted) ? r : null;
  }

  async function list(entity, { includeDeleted = false } = {}) {
    const all = await adapter.listByEntity(entity);
    return includeDeleted ? all : all.filter((r) => !r.deleted);
  }

  async function create(entity, fields = {}) {
    const id = fields.id ?? uuid();
    if (fields.id && (await adapter.get(entity, id))) throw new Error(`Record già esistente: ${entity}/${id}`);
    const now = stamp();
    const record = { ...fields, id, entity, createdAt: now, updatedAt: now, deleted: false };
    await commit([record]);
    return record;
  }

  async function update(entity, id, patch = {}) {
    const current = await adapter.get(entity, id);
    if (!current) throw new Error(`Record inesistente: ${entity}/${id}`);
    const clean = { ...patch };
    for (const f of SYSTEM_FIELDS) delete clean[f];
    delete clean.updatedAt;
    const record = { ...current, ...clean, updatedAt: stamp(current.updatedAt) };
    await commit([record]);
    return record;
  }

  /** Eliminazione logica: il record resta come tombstone per propagarsi alla sync. */
  function softDelete(entity, id) {
    return update(entity, id, { deleted: true });
  }

  /**
   * Scrive più modifiche in un'unica transazione (es. "Concludi spesa").
   * @param {Array<{ entity: string, id?: string, patch?: object, create?: object }>} ops
   */
  async function batch(ops) {
    const records = [];
    for (const op of ops) {
      if (op.create) {
        const now = stamp();
        records.push({ ...op.create, id: op.create.id ?? uuid(), entity: op.entity, createdAt: now, updatedAt: now, deleted: false });
      } else {
        const current = await adapter.get(op.entity, op.id);
        if (!current) throw new Error(`Record inesistente: ${op.entity}/${op.id}`);
        const clean = { ...op.patch };
        for (const f of [...SYSTEM_FIELDS, 'updatedAt']) delete clean[f];
        records.push({ ...current, ...clean, updatedAt: stamp(current.updatedAt) });
      }
    }
    return commit(records);
  }

  /**
   * Salva record già completi (dedupe, ripristino). Con `queue` vanno in outbox.
   * Non tocca updatedAt: chi chiama ne è responsabile.
   */
  function saveAll(records, { queue = true } = {}) {
    return commit(records, { queue });
  }

  /** Elimina definitivamente le tombstone più vecchie di 180 giorni. */
  async function purgeTombstones() {
    const cutoff = clock().getTime() - TOMBSTONE_TTL_DAYS * DAY_MS;
    const old = (await adapter.listAll()).filter((r) => r.deleted && Date.parse(r.updatedAt) < cutoff);
    if (old.length) {
      await adapter.remove(old.map((r) => [r.entity, r.id]));
      notifyChange(old.map((r) => r.entity), { broadcast: true });
    }
    return old.length;
  }

  return {
    get,
    list,
    listAll: () => adapter.listAll(),
    create,
    update,
    softDelete,
    batch,
    saveAll,
    purgeTombstones,
    outbox: () => adapter.outboxList(),
    outboxAck: (entries) => adapter.outboxAck(entries),
    /** Mette in coda record esistenti senza modificarli (primo collegamento al cloud). */
    enqueue: async (records) => { if (records.length) await adapter.commit([], records.map(outboxEntry)); },
    getMeta: (key) => adapter.metaGet(key),
    setMeta: (key, value) => adapter.metaSet(key, value),
    now: () => stamp(),
    close: () => adapter.close?.(),
  };
}

/* ---------- Orologio corretto ---------- */
/** Chiave in `meta` della correzione dell'orologio stimata dalla sync (ms). */
export const CLOCK_OFFSET_KEY = 'sync.clockOffset';
let clockOffset = 0;
/** Imposta la correzione (ms) da sommare all'orologio del dispositivo per le date dei record. */
export function setClockOffset(ms) { clockOffset = Number.isFinite(ms) ? ms : 0; }
export function getClockOffset() { return clockOffset; }
/** Ora del dispositivo corretta con lo scarto rispetto al server. */
export const appNow = () => new Date(Date.now() + clockOffset);

let shared = null;
/** Repository condiviso dell'app, aperto su IndexedDB alla prima richiesta. */
export function getRepo() {
  shared ??= openIdbAdapter().then(async (adapter) => {
    setClockOffset(await adapter.metaGet(CLOCK_OFFSET_KEY).catch(() => 0));
    return createRepo(adapter, { clock: appNow });
  });
  return shared;
}

/** Chiude il database (prima di cancellarlo). */
export async function closeRepo() {
  if (!shared) return;
  const repo = await shared.catch(() => null);
  shared = null;
  repo?.close();
}
