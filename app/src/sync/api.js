/*
 * Client REST di Supabase (PostgREST) per le tabelle `records` e `vault` (CLAUDE.md §8).
 * Nessun SDK: solo fetch. Ogni chiamata usa il token dell'utente; su 401 rinnova e riprova una volta.
 */
import { NetworkError } from './auth.js';

export class ApiError extends Error {
  /** @param {string} message @param {number} status @param {string} [code] */
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Errori per cui ha senso riprovare più tardi (rete, limiti, server). */
export function isRetryable(err) {
  if (err instanceof NetworkError) return true;
  if (err instanceof ApiError) return err.status === 408 || err.status === 429 || err.status >= 500;
  return false;
}

/* ---------- Istanti del server ---------- */

/**
 * Normalizza un timestamptz di Postgres (es. "2026-11-03T12:00:00.1234+00:00") in UTC a larghezza
 * fissa con microsecondi: "2026-11-03T12:00:00.123400Z". Così si confronta anche come stringa.
 */
export function normalizeTs(ts) {
  const m = /^(\d{4}-\d\d-\d\d)[T ](\d\d:\d\d:\d\d)(?:\.(\d+))?(Z|[+-]\d\d(?::?\d\d)?)?$/.exec(String(ts ?? '').trim());
  if (!m) throw new Error(`Istante non valido: ${ts}`);
  let zone = m[4] || 'Z';
  if (/^[+-]\d\d$/.test(zone)) zone += ':00';
  else if (/^[+-]\d{4}$/.test(zone)) zone = `${zone.slice(0, 3)}:${zone.slice(3)}`;
  const seconds = Date.parse(`${m[1]}T${m[2]}${zone}`);
  if (Number.isNaN(seconds)) throw new Error(`Istante non valido: ${ts}`);
  const micros = (m[3] || '').padEnd(6, '0').slice(0, 6);
  return `${new Date(seconds).toISOString().slice(0, 19)}.${micros}Z`;
}

/** Sposta un istante normalizzato di `ms` millisecondi (microsecondi conservati). */
export function shiftTs(norm, ms) {
  const seconds = Date.parse(`${norm.slice(0, 19)}Z`);
  const fraction = Number(norm.slice(20, 26)); // microsecondi
  const totalMicros = seconds * 1000 + fraction + ms * 1000;
  const secPart = Math.floor(totalMicros / 1_000_000) * 1000;
  const micros = String(totalMicros - secPart * 1000).padStart(6, '0');
  return `${new Date(secPart).toISOString().slice(0, 19)}.${micros}Z`;
}

/* ---------- Client ---------- */

const RECORD_COLUMNS = 'entity,id,updated_at,deleted,iv,payload,server_ts';

/**
 * @param {{ url: string, anonKey: string, getAccessToken: (o?: { force?: boolean }) => Promise<string>, fetch?: typeof fetch }} deps
 */
export function createApi({ url, anonKey, getAccessToken, fetch = (...a) => globalThis.fetch(...a) }) {
  async function call(path, { method = 'GET', body, headers = {} } = {}, retried = false) {
    const token = await getAccessToken({ force: retried });
    let res;
    try {
      res = await fetch(`${url}/rest/v1/${path}`, {
        method,
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      throw new NetworkError(err);
    }
    if (res.status === 401 && !retried) return call(path, { method, body, headers }, true);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new ApiError(data.message || `Errore ${res.status}`, res.status, data.code);
    }
    return res;
  }

  const json = async (res) => (res.status === 204 ? null : res.json());

  return {
    /** Vault dell'utente, o null se non è ancora stato creato. */
    async getVault() {
      const rows = await json(await call('vault?select=salt,verifier,iterations'));
      return rows?.[0] ?? null;
    },

    /** Crea il vault. Restituisce false se esiste già (creato da un altro dispositivo). */
    async createVault(vault) {
      try {
        await call('vault', { method: 'POST', body: vault, headers: { Prefer: 'return=minimal' } });
        return true;
      } catch (err) {
        if (err instanceof ApiError && (err.status === 409 || err.code === '23505')) return false;
        throw err;
      }
    },

    /** Scrive un lotto di righe cifrate; restituisce quante sono state davvero scritte. */
    async upsertRecords(rows) {
      return Number(await json(await call('rpc/upsert_records', { method: 'POST', body: { rows } }))) || 0;
    },

    /**
     * Una pagina di modifiche con server_ts ≥ `since`, in ordine stabile.
     * @returns {Promise<Array<{ entity, id, updated_at, deleted, iv, payload, server_ts }>>}
     */
    async fetchChanges({ since = null, offset = 0, limit = 500 } = {}) {
      const q = new URLSearchParams({ select: RECORD_COLUMNS, order: 'server_ts.asc,entity.asc,id.asc', limit: String(limit) });
      if (offset) q.set('offset', String(offset));
      if (since) q.set('server_ts', `gte.${since}`);
      return (await json(await call(`records?${q}`))) ?? [];
    },

    /** Numero di record non eliminati nel cloud. */
    async countRecords() {
      const res = await call('records?select=id&deleted=is.false&limit=1', { headers: { Prefer: 'count=exact' } });
      const total = /\/(\d+)$/.exec(res.headers.get('content-range') || '');
      return total ? Number(total[1]) : (await json(res))?.length ?? 0;
    },
  };
}

/**
 * Legge tutte le modifiche dal cursore in poi, pagina per pagina.
 * Righe con lo stesso server_ts a cavallo di due pagine: si riparte da quell'istante saltando
 * quelle già lette (offset). Con `overlapMs` si rilegge una piccola finestra prima del cursore,
 * per non perdere righe di transazioni concorrenti confermate con un istante appena precedente:
 * rileggerle è innocuo perché il merge le scarta.
 *
 * @param {(q: { since: string|null, offset: number, limit: number }) => Promise<Array<object>>} fetchPage
 * @param {string|null} cursor ultimo server_ts normalizzato già applicato
 * @param {{ pageSize?: number, overlapMs?: number, onPage: (rows: Array<object>) => Promise<void> }} opts
 * @returns {Promise<{ cursor: string|null, rows: number }>}
 */
export async function pullChanges(fetchPage, cursor, { pageSize = 500, overlapMs = 5000, onPage }) {
  let since = cursor ? shiftTs(cursor, -overlapMs) : null;
  let offset = 0;
  let last = cursor;
  let total = 0;
  for (;;) {
    const page = await fetchPage({ since, offset, limit: pageSize });
    const rows = page.map((r) => ({ ...r, server_ts: normalizeTs(r.server_ts) }));
    if (rows.length) await onPage(rows);
    total += rows.length;
    const lastTs = rows.at(-1)?.server_ts;
    if (lastTs && (!last || lastTs > last)) last = lastTs;
    if (rows.length < pageSize) return { cursor: last, rows: total };
    const tie = rows.filter((r) => r.server_ts === lastTs).length;
    offset = lastTs === since ? offset + tie : tie;
    since = lastTs;
  }
}
