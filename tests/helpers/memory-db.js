/** Adattatore in memoria con la stessa interfaccia di createIdbAdapter (solo per i test). */
export function createMemoryAdapter() {
  const records = new Map();
  const outbox = new Map();
  const meta = new Map();
  const k = (entity, id) => `${entity}\u0000${id}`;
  const clone = (v) => (v === undefined ? undefined : structuredClone(v));
  return {
    records, outbox, meta,
    async get(entity, id) { return clone(records.get(k(entity, id))) ?? null; },
    async listByEntity(entity) { return [...records.values()].filter((r) => r.entity === entity).map(clone); },
    async listAll() { return [...records.values()].map(clone); },
    async commit(recs, entries = []) {
      for (const r of recs) records.set(k(r.entity, r.id), clone(r));
      for (const e of entries) outbox.set(e.key, clone(e));
    },
    async remove(keys) { for (const [entity, id] of keys) records.delete(k(entity, id)); },
    async outboxList() { return [...outbox.values()].map(clone); },
    async outboxAck(entries) {
      for (const e of entries) if (outbox.get(e.key)?.updatedAt === e.updatedAt) outbox.delete(e.key);
    },
    async metaGet(key) { return clone(meta.get(key)); },
    async metaSet(key, value) { meta.set(key, clone(value)); },
  };
}
