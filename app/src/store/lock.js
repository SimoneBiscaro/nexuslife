/*
 * Blocco Salute (D7): PIN locale di 4–6 cifre (hash PBKDF2 nello store "meta", mai sincronizzato),
 * richiesto aprendo Salute dopo 5 minuti di inattività. WebAuthn (Face ID / Touch ID) come alternativa.
 * È una protezione della vista sul dispositivo, non una cifratura dei dati locali.
 */
import { signal } from './state.js';
import { getRepo } from './repo.js';
import { fromBase64, hashPin, randomBytes, toBase64, verifyPin } from '../sync/crypto.js';

export const LOCK_TIMEOUT_MS = 5 * 60 * 1000;
const PIN_KEY = 'healthPin';
const WEBAUTHN_KEY = 'healthWebAuthn';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

/** true finché Salute è sbloccata (e c'è attività entro 5 minuti). */
export const unlocked = signal(false);
let lastActivity = 0;
let failures = 0;
let lockoutUntil = 0;

export function touchActivity(now = Date.now()) {
  if (unlocked.value) lastActivity = now;
}

/** Ricontrolla il timeout: se scaduto, blocca. */
export function checkTimeout(now = Date.now()) {
  if (unlocked.value && now - lastActivity > LOCK_TIMEOUT_MS) unlocked.value = false;
  return unlocked.value;
}

export function lockNow() { unlocked.value = false; }

function markUnlocked() {
  failures = 0;
  lastActivity = Date.now();
  unlocked.value = true;
}

export const isValidPin = (pin) => /^\d{4,6}$/.test(pin);

export async function hasPin() {
  return Boolean(await (await getRepo()).getMeta(PIN_KEY));
}

export async function setPin(pin) {
  if (!isValidPin(pin)) throw new Error('Il PIN deve avere da 4 a 6 cifre');
  await (await getRepo()).setMeta(PIN_KEY, await hashPin(pin));
  markUnlocked();
}

export async function clearPin() {
  const repo = await getRepo();
  await repo.setMeta(PIN_KEY, null);
  await repo.setMeta(WEBAUTHN_KEY, null);
}

/**
 * Verifica il PIN. Dopo 5 errori consecutivi blocca i tentativi per 30 secondi.
 * @returns {Promise<{ ok: boolean, waitMs?: number }>}
 */
export async function unlockWithPin(pin) {
  const now = Date.now();
  if (now < lockoutUntil) return { ok: false, waitMs: lockoutUntil - now };
  const ok = await verifyPin(pin, await (await getRepo()).getMeta(PIN_KEY));
  if (ok) { markUnlocked(); return { ok: true }; }
  failures += 1;
  if (failures >= MAX_ATTEMPTS) { failures = 0; lockoutUntil = Date.now() + LOCKOUT_MS; return { ok: false, waitMs: LOCKOUT_MS }; }
  return { ok: false };
}

/** Solo verifica (es. per disattivare il blocco), senza sbloccare. */
export async function checkPin(pin) {
  return verifyPin(pin, await (await getRepo()).getMeta(PIN_KEY));
}

/* ---------- WebAuthn ---------- */

export async function webAuthnAvailable() {
  try {
    return typeof PublicKeyCredential !== 'undefined'
      && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

export async function hasWebAuthn() {
  return Boolean(await (await getRepo()).getMeta(WEBAUTHN_KEY));
}

/** Registra Face ID / Touch ID di questo dispositivo. */
export async function registerWebAuthn() {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: 'NexusLife', id: location.hostname },
      user: { id: randomBytes(16), name: 'nexuslife-salute', displayName: 'NexusLife Salute' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60_000,
      attestation: 'none',
    },
  });
  await (await getRepo()).setMeta(WEBAUTHN_KEY, { id: toBase64(new Uint8Array(cred.rawId)) });
}

export async function removeWebAuthn() {
  await (await getRepo()).setMeta(WEBAUTHN_KEY, null);
}

/** Sblocco con Face ID / Touch ID (verifica dell'utente fatta dal dispositivo). */
export async function unlockWithWebAuthn() {
  const stored = await (await getRepo()).getMeta(WEBAUTHN_KEY);
  if (!stored) return false;
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [{ type: 'public-key', id: fromBase64(stored.id) }],
      userVerification: 'required',
      timeout: 60_000,
    },
  });
  if (!assertion) return false;
  markUnlocked();
  return true;
}
