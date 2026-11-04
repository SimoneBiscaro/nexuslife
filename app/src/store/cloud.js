/*
 * Collegamento della sync cifrata all'app: sessione, vault, chiave in memoria (o ricordata),
 * pianificazione (avvio, ritorno online, ogni 60 s in primo piano, manuale) e retry con backoff.
 * Lo stato è un segnale letto dall'indicatore in TabBar, Sidebar, Topbar e da Impostazioni.
 */
import { signal } from './state.js';
import { getRepo } from './repo.js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../../config.js';
import { AuthError, createAuth, NetworkError } from '../sync/auth.js';
import { ApiError, createApi, isRetryable } from '../sync/api.js';
import { createVault, DecryptError, openVault, WrongPassphrase } from '../sync/crypto.js';
import { META, runSync } from '../sync/sync.js';

export const cloudConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const SYNC_INTERVAL_MS = 60_000;
/** Attese tra un tentativo fallito e il successivo, in secondi. */
export const BACKOFF_S = [2, 4, 8, 16, 32, 60, 120, 300];
/** Passphrase del cloud: almeno 12 caratteri (meglio una frase di 4–5 parole). */
export const MIN_PASSPHRASE = 12;
const USER_KEY = 'sync.userId';

/**
 * phase:
 *  off       non configurata o nessun accesso su questo dispositivo
 *  expired   sessione scaduta: serve un nuovo accesso
 *  locked    accesso fatto, manca la passphrase (vault da creare o da aprire)
 *  idle      pronta, in attesa della prima sincronizzazione
 *  syncing   in corso
 *  ok        sincronizzata
 *  offline   senza rete
 *  error     ultimo tentativo fallito (con retry pianificato se ha senso)
 */
export const syncState = signal({
  phase: 'off', email: null, lastSyncAt: null, error: null, vault: null, remembered: false, retryAt: null,
});

const set = (patch) => { syncState.value = { ...syncState.value, ...patch }; };

let auth = null;
let api = null;
let key = null;
let started = false;
let running = null;
let again = null;
let failures = 0;
let retryTimer = 0;

const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;

/** Messaggio in italiano per un errore di sync. */
export function describeSyncError(err) {
  if (err instanceof DecryptError) return 'Dati nel cloud non decifrabili con questa passphrase';
  if (err instanceof WrongPassphrase) return 'Passphrase non corretta';
  if (err instanceof NetworkError) return 'Supabase non raggiungibile';
  if (err instanceof AuthError) return err.message;
  if (err instanceof ApiError) {
    if (err.status === 404 || ['PGRST202', 'PGRST205', '42P01', '42883'].includes(err.code)) {
      return 'Tabelle mancanti su Supabase: esegui docs/supabase.sql';
    }
    if (err.status === 403 || err.code === '42501') return 'Accesso negato dal server (RLS)';
    if (err.status === 429) return 'Troppe richieste: riprovo tra poco';
    if (err.status >= 500) return 'Il server non risponde: riprovo tra poco';
    return `Errore del server (${err.status})`;
  }
  return err?.message || 'Errore sconosciuto';
}

function withLock(fn) {
  // Più schede aperte: una sola sincronizza alla volta.
  if (typeof navigator !== 'undefined' && navigator.locks?.request) return navigator.locks.request('nexuslife-sync', fn);
  return fn();
}

function clients(repo) {
  auth ??= createAuth({
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    load: () => repo.getMeta(META.session),
    save: (s) => repo.setMeta(META.session, s),
  });
  api ??= createApi({ url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, getAccessToken: (o) => auth.getAccessToken(o) });
}

function scheduleRetry() {
  clearTimeout(retryTimer);
  const delay = BACKOFF_S[Math.min(failures, BACKOFF_S.length - 1)] * 1000;
  failures += 1;
  const retryAt = Date.now() + delay;
  retryTimer = setTimeout(() => { syncNow(); }, delay);
  return retryAt;
}

function handleError(err) {
  if (err instanceof AuthError && (err.code === 'session_expired' || err.code === 'not_signed_in')) {
    set({ phase: 'expired', error: err.message, retryAt: null });
    return;
  }
  if (err instanceof NetworkError && !isOnline()) {
    set({ phase: 'offline', error: null, retryAt: null });
    return;
  }
  const retry = !(err instanceof DecryptError) && (isRetryable(err) || err instanceof ApiError);
  set({ phase: 'error', error: describeSyncError(err), retryAt: retry ? scheduleRetry() : null });
  // Rete e server temporaneamente giù sono attesi: in console solo gli errori inattesi.
  if (!isRetryable(err)) console.warn('Sync:', err);
}

/**
 * Sincronizza adesso. Se è già in corso, ne accoda un'altra al termine.
 * @param {{ pushOnly?: boolean }} [opts]
 */
export function syncNow({ pushOnly = false } = {}) {
  if (!cloudConfigured || !key || !auth) return Promise.resolve(null);
  if (!isOnline()) {
    set({ phase: 'offline', retryAt: null });
    return Promise.resolve(null);
  }
  if (running) {
    again = again === null ? pushOnly : again && pushOnly;
    return running;
  }
  clearTimeout(retryTimer);
  running = (async () => {
    set({ phase: 'syncing', error: null, retryAt: null });
    try {
      const repo = await getRepo();
      const res = await withLock(() => runSync({ repo, api, key, pushOnly }));
      const lastSyncAt = new Date().toISOString();
      await repo.setMeta(META.lastSyncAt, lastSyncAt);
      failures = 0;
      set({ phase: 'ok', lastSyncAt, error: null });
      return res;
    } catch (err) {
      handleError(err);
      return null;
    } finally {
      running = null;
      if (again !== null) {
        const next = again;
        again = null;
        syncNow({ pushOnly: next });
      }
    }
  })();
  return running;
}

function attachListeners() {
  if (typeof window === 'undefined') return;
  window.addEventListener('online', () => { if (key) syncNow(); });
  window.addEventListener('offline', () => { if (key) set({ phase: 'offline', retryAt: null }); });
  document.addEventListener('visibilitychange', () => {
    if (!key) return;
    // In primo piano si scarica subito; uscendo si inviano le modifiche ancora in coda.
    if (document.visibilityState === 'visible') syncNow();
    else syncNow({ pushOnly: true });
  });
  setInterval(() => {
    if (key && document.visibilityState === 'visible') syncNow();
  }, SYNC_INTERVAL_MS);
}

/** Avvio: riprende la sessione salvata e, se la chiave è ricordata, sincronizza. */
export async function initCloud() {
  if (!cloudConfigured || started) return;
  started = true;
  const repo = await getRepo();
  clients(repo);
  attachListeners();
  const [session, savedKey, lastSyncAt] = await Promise.all([
    auth.getSession(), repo.getMeta(META.key), repo.getMeta(META.lastSyncAt),
  ]);
  if (!session) {
    set({ phase: 'off', lastSyncAt: lastSyncAt ?? null });
    return;
  }
  key = savedKey ?? null;
  set({ email: session.user?.email ?? null, lastSyncAt: lastSyncAt ?? null, remembered: Boolean(key), phase: key ? 'idle' : 'locked' });
  if (key) syncNow();
}

/** Legge dal cloud se il vault esiste già (per scegliere tra "crea" e "inserisci" passphrase). */
export async function refreshVaultInfo() {
  if (!api) return null;
  try {
    const vault = await api.getVault();
    set({ vault: vault ? 'present' : 'missing' });
    return vault;
  } catch (err) {
    set({ vault: null, error: describeSyncError(err) });
    throw err;
  }
}

async function resetSyncMeta(repo) {
  await Promise.all([META.key, META.cursor, META.initialDone, META.lastSyncAt, USER_KEY].map((k) => repo.setMeta(k, null)));
}

/** Accesso con email e password. */
export async function signIn(email, password) {
  const repo = await getRepo();
  clients(repo);
  const session = await auth.signIn(email, password);
  // Un account diverso dal precedente riparte da zero (chiave e cursore sono per utente).
  const previous = await repo.getMeta(USER_KEY);
  if (previous && previous !== session.user.id) {
    await resetSyncMeta(repo);
    key = null;
  }
  await repo.setMeta(USER_KEY, session.user.id);
  set({ email: session.user.email, phase: key ? 'idle' : 'locked', error: null, vault: null });
  if (key) syncNow();
  else await refreshVaultInfo().catch(() => {});
  return session;
}

async function adoptKey(newKey, remember) {
  const repo = await getRepo();
  key = newKey;
  // La CryptoKey non è estraibile: in IndexedDB finisce l'oggetto, non i byte della chiave.
  await repo.setMeta(META.key, remember ? newKey : null);
  set({ phase: 'idle', vault: 'present', remembered: remember, error: null });
  return syncNow();
}

/** Primo dispositivo: crea il vault con una nuova passphrase. */
export async function createPassphrase(passphrase, { remember = true } = {}) {
  const { key: newKey, vault } = await createVault(passphrase);
  if (await api.createVault(vault)) return adoptKey(newKey, remember);
  // Un altro dispositivo l'ha creato nel frattempo: la passphrase deve essere quella.
  set({ vault: 'present' });
  return unlock(passphrase, { remember });
}

/** Dispositivi successivi: verifica la passphrase con il vault. */
export async function unlock(passphrase, { remember = true } = {}) {
  const vault = await api.getVault();
  if (!vault) {
    set({ vault: 'missing' });
    throw new Error('Nessun vault nel cloud: crea la passphrase');
  }
  return adoptKey(await openVault(passphrase, vault), remember);
}

/** La chiave resta in memoria fino alla chiusura, ma non più in IndexedDB. */
export async function forgetKey() {
  const repo = await getRepo();
  await repo.setMeta(META.key, null);
  set({ remembered: false });
}

/** "Disconnetti questo dispositivo": esce e dimentica chiave e cursore. I dati locali restano. */
export async function disconnect() {
  const repo = await getRepo();
  clients(repo);
  clearTimeout(retryTimer);
  key = null;
  failures = 0;
  await auth.signOut();
  await resetSyncMeta(repo);
  set({ phase: 'off', email: null, lastSyncAt: null, error: null, vault: null, remembered: false, retryAt: null });
}

/** Prima di cancellare il database locale: revoca la sessione (senza attendere a lungo). */
export async function signOutQuietly() {
  if (!auth) return;
  await Promise.race([auth.signOut().catch(() => {}), new Promise((r) => setTimeout(r, 3000))]);
}

/** Numeri per Impostazioni: record locali, in coda, nel cloud (null se non disponibile). */
export async function cloudStats() {
  const repo = await getRepo();
  const [all, outbox] = await Promise.all([repo.listAll(), repo.outbox()]);
  let cloud = null;
  if (key && api && isOnline()) cloud = await api.countRecords().catch(() => null);
  return { local: all.filter((r) => !r.deleted).length, pending: outbox.length, cloud };
}
