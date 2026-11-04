/*
 * Accesso a Supabase Auth (GoTrue) via REST, senza SDK (CLAUDE.md §2 e §8).
 * Email + password, refresh automatico del token, logout. La sessione è salvata da chi
 * chiama (in IndexedDB, store `meta`) tramite le funzioni `load` e `save`.
 */

/** Il token viene rinnovato quando mancano meno di 60 s alla scadenza. */
export const REFRESH_MARGIN_MS = 60_000;

export class AuthError extends Error {
  /** @param {string} message @param {string} code @param {number} [status] */
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class NetworkError extends Error {
  constructor(cause) {
    super('Rete non disponibile');
    this.code = 'network';
    this.cause = cause;
  }
}

/** Messaggio in italiano per una risposta d'errore di GoTrue. */
export function authErrorFrom(status, body = {}) {
  const code = body.error_code || body.code || body.error || '';
  const text = `${code} ${body.error_description || body.msg || body.message || ''}`.toLowerCase();
  if (status === 429 || text.includes('rate limit')) return new AuthError('Troppi tentativi: riprova tra qualche minuto', 'rate_limit', status);
  if (text.includes('email_not_confirmed') || text.includes('not confirmed')) {
    return new AuthError('Email non confermata: conferma l\'utente in Supabase', 'email_not_confirmed', status);
  }
  if (text.includes('invalid_credentials') || text.includes('invalid login') || code === 'invalid_grant') {
    return new AuthError('Email o password non corretti', 'invalid_credentials', status);
  }
  if (status >= 500) return new AuthError('Il servizio di accesso non risponde: riprova più tardi', 'server', status);
  return new AuthError('Accesso non riuscito', code || 'auth', status);
}

/** Sotto questo scarto l'orologio del dispositivo si considera giusto (iat ha la precisione del secondo). */
export const SKEW_TOLERANCE_MS = 3000;

/** Istante di emissione del token (claim `iat` del JWT) in millisecondi, o null. */
export function tokenIssuedAt(jwt) {
  try {
    const part = String(jwt).split('.')[1];
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const iat = JSON.parse(atob(b64)).iat;
    return Number.isFinite(iat) ? iat * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Correzione da applicare all'orologio del dispositivo (ms): 0 se lo scarto è entro la tolleranza.
 * @param {number|null|undefined} skewMs ora del server − ora del dispositivo
 */
export function clockCorrection(skewMs) {
  if (!Number.isFinite(skewMs) || Math.abs(skewMs) < SKEW_TOLERANCE_MS) return 0;
  return Math.round(skewMs);
}

/**
 * Sessione salvata a partire dalla risposta di /token.
 * La scadenza si calcola da `expires_in` con l'orologio locale: così un telefono avanti o indietro
 * di qualche minuto non scambia un token valido per scaduto (o viceversa).
 * `skewMs` = ora del server (iat) − ora del dispositivo.
 */
export function sessionFrom(res, now) {
  if (!res?.access_token || !res?.refresh_token) throw new AuthError('Risposta di accesso non valida', 'invalid_response');
  const expiresAt = Number.isFinite(res.expires_in) ? now + res.expires_in * 1000 : (res.expires_at ?? 0) * 1000 || now + 3600_000;
  const iat = tokenIssuedAt(res.access_token);
  return {
    accessToken: res.access_token,
    refreshToken: res.refresh_token,
    expiresAt,
    skewMs: iat === null ? null : iat - now,
    user: { id: res.user?.id ?? null, email: res.user?.email ?? null },
  };
}

/**
 * @param {{
 *   url: string, anonKey: string,
 *   load: () => Promise<object|null>, save: (session: object|null) => Promise<void>,
 *   fetch?: typeof fetch, clock?: () => number,
 * }} deps
 */
export function createAuth({ url, anonKey, load, save, fetch = (...a) => globalThis.fetch(...a), clock = () => Date.now() }) {
  let session; // undefined = non ancora letta
  let refreshing = null;

  async function post(path, body, token) {
    const headers = { apikey: anonKey, 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    let res;
    try {
      res = await fetch(`${url}/auth/v1/${path}`, { method: 'POST', headers, body: JSON.stringify(body ?? {}) });
    } catch (err) {
      throw new NetworkError(err);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw authErrorFrom(res.status, data);
    return data;
  }

  async function current() {
    if (session === undefined) session = (await load()) ?? null;
    return session;
  }

  async function store(next) {
    session = next;
    await save(next);
    return next;
  }

  async function signIn(email, password) {
    const res = await post('token?grant_type=password', { email: String(email).trim(), password });
    return store(sessionFrom(res, clock()));
  }

  async function doRefresh() {
    const mine = await current();
    if (!mine) throw new AuthError('Accesso richiesto', 'not_signed_in');
    // Un'altra scheda può aver già rinnovato: in quel caso il refresh token salvato è cambiato.
    const saved = (await load()) ?? null;
    if (saved?.refreshToken && saved.refreshToken !== mine.refreshToken && saved.expiresAt - REFRESH_MARGIN_MS > clock()) {
      session = saved;
      return saved;
    }
    try {
      const res = await post('token?grant_type=refresh_token', { refresh_token: mine.refreshToken });
      return await store(sessionFrom(res, clock()));
    } catch (err) {
      if (err instanceof AuthError && err.status >= 400 && err.status < 500 && err.code !== 'rate_limit') {
        await store(null);
        throw new AuthError('Sessione scaduta: accedi di nuovo', 'session_expired', err.status);
      }
      throw err;
    }
  }

  /** Rinnovo con una sola richiesta in volo alla volta (il refresh token è monouso). */
  function refresh() {
    refreshing ??= doRefresh().finally(() => { refreshing = null; });
    return refreshing;
  }

  /** Token valido per le chiamate REST; lo rinnova se sta per scadere (o se `force`). */
  async function getAccessToken({ force = false } = {}) {
    let s = await current();
    if (!s) throw new AuthError('Accesso richiesto', 'not_signed_in');
    if (force || s.expiresAt - REFRESH_MARGIN_MS <= clock()) s = await refresh();
    return s.accessToken;
  }

  /** Esce da questo dispositivo: revoca la sessione sul server (se raggiungibile) e la cancella. */
  async function signOut() {
    const s = await current();
    await store(null);
    if (!s) return;
    try {
      await post('logout?scope=local', {}, s.accessToken);
    } catch {
      // offline o token già scaduto: la sessione locale è comunque cancellata
    }
  }

  return { signIn, signOut, refresh, getAccessToken, getSession: current };
}
