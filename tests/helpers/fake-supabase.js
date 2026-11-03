/*
 * Finto Supabase in memoria per i test: GoTrue (/auth/v1/token, /logout) e PostgREST
 * (/rest/v1/vault, /rest/v1/records, /rest/v1/rpc/upsert_records) con le stesse regole di
 * docs/supabase.sql: righe per utente, last-writer-wins su updated_at, server_ts dal server.
 * Restituisce `fetch` da passare a createAuth/createApi.
 */
export const FAKE_URL = 'https://fake.supabase.co';
export const FAKE_KEY = 'sb_publishable_test';

/** Microsecondi → timestamptz come lo stampa Postgres (zeri finali tolti, "+00:00"). */
export function pgTs(micros) {
  const ms = Math.floor(micros / 1000);
  const frac = String(micros % 1_000_000).padStart(6, '0').replace(/0+$/, '');
  return `${new Date(Math.floor(ms / 1000) * 1000).toISOString().slice(0, 19)}${frac ? `.${frac}` : ''}+00:00`;
}

const json = (status, body, headers = {}) => new Response(body === undefined ? null : JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', ...headers },
});

export function createFakeSupabase({ users = [{ id: 'u1', email: 'simo@example.com', password: 'password-giusta' }] } = {}) {
  const tokens = new Map(); // access token → { userId, expiresAt }
  const refreshTokens = new Map(); // refresh token → userId
  const vaults = new Map();
  const records = new Map(); // `${user}|${entity}|${id}` → row
  let micros = Date.parse('2026-11-03T10:00:00Z') * 1000;
  let seq = 0;
  const state = {
    calls: [],
    /** Se valorizzato, server_ts resta fisso (righe con lo stesso istante). */
    frozenTs: null,
    tokenTtl: 3600,
    failNext: 0,
    offline: false,
    now: () => Date.now(),
  };

  const issue = (userId) => {
    const access = `at-${++seq}`;
    const refresh = `rt-${seq}`;
    tokens.set(access, { userId, expiresAt: state.now() + state.tokenTtl * 1000 });
    refreshTokens.set(refresh, userId);
    const user = users.find((u) => u.id === userId);
    return { access_token: access, refresh_token: refresh, expires_in: state.tokenTtl, token_type: 'bearer', user: { id: user.id, email: user.email } };
  };

  const authUser = (headers) => {
    const t = (headers.Authorization || '').replace('Bearer ', '');
    const info = tokens.get(t);
    if (!info || info.expiresAt <= state.now()) return null;
    return info.userId;
  };

  const nextTs = () => {
    if (state.frozenTs) return state.frozenTs;
    micros += 137; // istanti distinti al microsecondo, come clock_timestamp()
    return micros;
  };

  async function fetch(input, init = {}) {
    if (state.offline) throw new TypeError('Failed to fetch');
    const url = new URL(input);
    const method = init.method || 'GET';
    const headers = init.headers || {};
    const body = init.body ? JSON.parse(init.body) : undefined;
    state.calls.push({ method, path: url.pathname, search: url.search, body });
    if (headers.apikey !== FAKE_KEY) return json(401, { message: 'Invalid API key' });
    if (state.failNext > 0) { state.failNext--; return json(503, { message: 'Service Unavailable' }); }

    // ---------- Auth ----------
    if (url.pathname === '/auth/v1/token') {
      const grant = url.searchParams.get('grant_type');
      if (grant === 'password') {
        const u = users.find((x) => x.email === body.email && x.password === body.password);
        if (!u) return json(400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
        return json(200, issue(u.id));
      }
      if (grant === 'refresh_token') {
        const userId = refreshTokens.get(body.refresh_token);
        if (!userId) return json(400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
        refreshTokens.delete(body.refresh_token); // monouso
        return json(200, issue(userId));
      }
    }
    if (url.pathname === '/auth/v1/logout') {
      const t = (headers.Authorization || '').replace('Bearer ', '');
      tokens.delete(t);
      return new Response(null, { status: 204 });
    }

    // ---------- REST ----------
    const userId = authUser(headers);
    if (!userId) return json(401, { code: 'PGRST301', message: 'JWT expired' });

    if (url.pathname === '/rest/v1/vault') {
      if (method === 'GET') return json(200, vaults.has(userId) ? [vaults.get(userId)] : []);
      if (method === 'POST') {
        if (vaults.has(userId)) return json(409, { code: '23505', message: 'duplicate key value violates unique constraint "vault_pkey"' });
        vaults.set(userId, { salt: body.salt, verifier: body.verifier, iterations: body.iterations });
        return new Response(null, { status: 201 });
      }
    }

    if (url.pathname === '/rest/v1/rpc/upsert_records' && method === 'POST') {
      let written = 0;
      for (const r of body.rows) {
        const k = `${userId}|${r.entity}|${r.id}`;
        const prev = records.get(k);
        if (prev && !(Date.parse(r.updated_at) > Date.parse(prev.updated_at))) continue;
        records.set(k, { user_id: userId, entity: r.entity, id: r.id, updated_at: r.updated_at, deleted: Boolean(r.deleted), iv: r.iv, payload: r.payload, server_micros: nextTs() });
        written++;
      }
      return json(200, written);
    }

    if (url.pathname === '/rest/v1/records' && method === 'GET') {
      const q = url.searchParams;
      let rows = [...records.values()].filter((r) => r.user_id === userId);
      const since = q.get('server_ts');
      if (since) {
        const m = /^gte\.(.+)$/.exec(since);
        const sinceMicros = parseTsMicros(m[1]);
        rows = rows.filter((r) => r.server_micros >= sinceMicros);
      }
      if (q.get('deleted') === 'is.false') rows = rows.filter((r) => !r.deleted);
      rows.sort((a, b) => a.server_micros - b.server_micros || cmp(a.entity, b.entity) || cmp(a.id, b.id));
      const total = rows.length;
      const offset = Number(q.get('offset') || 0);
      const limit = Number(q.get('limit') || 1000);
      const page = rows.slice(offset, offset + limit).map((r) => ({
        entity: r.entity, id: r.id, updated_at: pgTs(Date.parse(r.updated_at) * 1000), deleted: r.deleted, iv: r.iv, payload: r.payload, server_ts: pgTs(r.server_micros),
      }));
      const extra = (headers.Prefer || '').includes('count=exact') ? { 'Content-Range': `0-${Math.max(0, page.length - 1)}/${total}` } : {};
      return json(200, q.get('select') === 'id' ? page.map((r) => ({ id: r.id })) : page, extra);
    }

    return json(404, { code: 'PGRST202', message: `Not found: ${method} ${url.pathname}` });
  }

  return {
    fetch,
    state,
    records,
    vaults,
    tokens,
    /** Righe di un utente così come le vede il server. */
    rows: (userId = 'u1') => [...records.values()].filter((r) => r.user_id === userId),
    expireAllTokens: () => { for (const t of tokens.values()) t.expiresAt = 0; },
    tick: (us) => { micros += us; },
    currentMicros: () => micros,
  };
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function parseTsMicros(ts) {
  const m = /^(.{19})(?:\.(\d+))?(Z|[+-]\d\d:\d\d)$/.exec(ts);
  if (!m) throw new Error(`ts non valido nel test: ${ts}`);
  return Date.parse(`${m[1]}${m[3]}`) * 1000 + Number((m[2] || '').padEnd(6, '0').slice(0, 6));
}
