/*
 * Motore di sincronizzazione (CLAUDE.md §8): outbox → RPC a lotti, lettura incrementale per
 * server_ts, decifratura, merge last-writer-wins per record, poi deduplicazione (§7).
 * Nessun accesso a DOM o timer: le dipendenze (repo, api, chiave) arrivano come parametri,
 * così lo stesso codice gira nel browser e nei test Node.
 */
import { decryptRecord, encryptRecord } from './crypto.js';
import { pullChanges } from './api.js';
import { dedupe } from '../domain/dedupe.js';

export const PUSH_BATCH = 200;
export const PULL_PAGE = 500;

/** Chiavi nello store `meta`. */
export const META = {
  session: 'sync.session',
  key: 'sync.key',
  cursor: 'sync.cursor',
  initialDone: 'sync.initialDone',
  lastSyncAt: 'sync.lastSyncAt',
};

const keyOf = (r) => `${r.entity}:${r.id}`;
const time = (iso) => Date.parse(iso);

/**
 * Decide se una versione remota sostituisce quella locale (last-writer-wins).
 * Con `preferRemote` (primo collegamento del dispositivo) vince la remota anche a parità o se più
 * vecchia: serve al record `settings`, che ogni dispositivo crea al primo avvio con id fisso.
 */
export function remoteWins(local, remote, { preferRemote = false } = {}) {
  if (!local) return true;
  if (preferRemote) return local.updatedAt !== remote.updatedAt || Boolean(local.deleted) !== Boolean(remote.deleted);
  return time(remote.updatedAt) > time(local.updatedAt);
}

/**
 * Merge puro: record remoti già decifrati contro quelli locali.
 * @param {Map<string, object>} localByKey
 * @param {Array<object>} remote
 * @returns {Array<object>} versioni remote da salvare in locale
 */
export function mergeRemote(localByKey, remote, opts = {}) {
  const out = new Map();
  for (const r of remote) {
    const k = keyOf(r);
    const local = out.get(k) ?? localByKey.get(k);
    if (remoteWins(local, r, opts)) out.set(k, r);
  }
  return [...out.values()];
}

/**
 * Istante per le correzioni della dedupe: successivo a ogni updatedAt noto, così vince
 * sul server anche se un altro dispositivo ha l'orologio avanti.
 */
export function stampAfter(now, records) {
  let max = time(now);
  for (const r of records) {
    const t = time(r.updatedAt);
    if (t >= max) max = t + 1;
  }
  return new Date(max).toISOString();
}

/** Riga per la tabella `records`: in chiaro solo entity, id, updated_at, deleted. */
export async function toRow(key, record) {
  const { iv, payload } = await encryptRecord(key, record);
  return { entity: record.entity, id: record.id, updated_at: record.updatedAt, deleted: Boolean(record.deleted), iv, payload };
}

/**
 * Invia la outbox a lotti di 200. Una voce esce dalla coda solo se il record non è cambiato
 * nel frattempo (outboxAck confronta updatedAt).
 * @returns {Promise<number>} record inviati
 */
export async function pushOutbox({ repo, api, key, batchSize = PUSH_BATCH }) {
  const entries = await repo.outbox();
  let sent = 0;
  for (let i = 0; i < entries.length; i += batchSize) {
    const slice = entries.slice(i, i + batchSize);
    const rows = [];
    const acks = [];
    for (const e of slice) {
      const record = await repo.get(e.entity, e.id, { includeDeleted: true });
      if (!record) { acks.push(e); continue; } // tombstone già eliminata in locale: niente da inviare
      rows.push(await toRow(key, record));
      acks.push({ key: e.key, updatedAt: record.updatedAt });
    }
    if (rows.length) await api.upsertRecords(rows);
    await repo.outboxAck(acks);
    sent += rows.length;
  }
  return sent;
}

/**
 * Scarica le modifiche dal cursore, decifra solo le righe più nuove della copia locale
 * (updated_at è in chiaro) e le salva senza rimetterle in outbox.
 * @returns {Promise<{ cursor: string|null, received: number, applied: number }>}
 */
export async function pullRemote({ repo, api, key, cursor, preferRemote = false, pageSize = PULL_PAGE }) {
  let applied = 0;
  const res = await pullChanges((q) => api.fetchChanges(q), cursor, {
    pageSize,
    onPage: async (rows) => {
      const localByKey = new Map();
      const fresh = [];
      for (const row of rows) {
        const local = await repo.get(row.entity, row.id, { includeDeleted: true });
        if (local) localByKey.set(keyOf(local), local);
        const stub = { updatedAt: row.updated_at, deleted: row.deleted };
        if (!local || preferRemote || remoteWins(local, stub)) fresh.push(row);
      }
      const decrypted = [];
      for (const row of fresh) decrypted.push(await decryptRecord(key, row));
      const winners = mergeRemote(localByKey, decrypted, { preferRemote });
      if (winners.length) await repo.saveAll(winners, { queue: false });
      applied += winners.length;
    },
  });
  return { cursor: res.cursor, received: res.rows, applied };
}

/**
 * Sincronizzazione completa.
 * - Primo collegamento del dispositivo: prima si scarica (vince il cloud sui record con lo stesso id),
 *   poi tutti i record locali entrano in outbox.
 * - Poi: invio outbox → lettura incrementale → dedupe → invio delle correzioni della dedupe.
 * @param {{ repo: object, api: object, key: CryptoKey, pushOnly?: boolean }} deps
 * @returns {Promise<{ pushed: number, received: number, applied: number, deduped: number, initial: boolean }>}
 */
export async function runSync({ repo, api, key, pushOnly = false }) {
  const initial = !(await repo.getMeta(META.initialDone));
  if (pushOnly && !initial) {
    return { pushed: await pushOutbox({ repo, api, key }), received: 0, applied: 0, deduped: 0, initial };
  }
  let pushed = 0;
  let pulled;
  if (initial) {
    pulled = await pullRemote({ repo, api, key, cursor: null, preferRemote: true });
    await repo.enqueue(await repo.listAll());
  } else {
    pushed += await pushOutbox({ repo, api, key });
    pulled = await pullRemote({ repo, api, key, cursor: (await repo.getMeta(META.cursor)) ?? null });
  }

  const all = await repo.listAll();
  const fixes = dedupe(all, stampAfter(repo.now(), all));
  if (fixes.length) await repo.saveAll(fixes);
  pushed += await pushOutbox({ repo, api, key });

  // Il cursore avanza solo a sync riuscita: se qualcosa fallisce, la prossima volta si rilegge.
  if (pulled.cursor) await repo.setMeta(META.cursor, pulled.cursor);
  if (initial) await repo.setMeta(META.initialDone, repo.now());
  return { pushed, received: pulled.received, applied: pulled.applied, deduped: fixes.length, initial };
}
