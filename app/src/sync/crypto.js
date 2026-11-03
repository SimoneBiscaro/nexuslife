/*
 * Primitive crittografiche su WebCrypto (CLAUDE.md §2 e §8):
 * AES-GCM 256 con chiave derivata da PBKDF2-SHA256, 600.000 iterazioni.
 * Funziona sia nel browser sia in Node 20+ (globalThis.crypto).
 */

export const PBKDF2_ITERATIONS = 600_000;
const subtle = () => globalThis.crypto.subtle;
const enc = new TextEncoder();

export function randomBytes(n) {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

export function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(text) {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function toHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 esadecimale di byte o testo. */
export async function sha256Hex(data) {
  const bytes = typeof data === 'string' ? enc.encode(data) : data;
  return toHex(new Uint8Array(await subtle().digest('SHA-256', bytes)));
}

/** Confronto a tempo costante. */
export function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Chiave AES-GCM non estraibile derivata dalla passphrase. */
export async function deriveKey(passphrase, salt, iterations = PBKDF2_ITERATIONS) {
  const base = await subtle().importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBytes(key, bytes) {
  const iv = randomBytes(12);
  const data = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, bytes));
  return { iv, data };
}

export async function decryptBytes(key, iv, data) {
  return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv }, key, data));
}

/**
 * Hash del PIN (PBKDF2-SHA256): restituisce ciò che va salvato in locale.
 * @returns {Promise<{ hash: string, salt: string, iterations: number }>}
 */
export async function hashPin(pin, { salt = randomBytes(16), iterations = PBKDF2_ITERATIONS } = {}) {
  const base = await subtle().importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, 256);
  return { hash: toBase64(new Uint8Array(bits)), salt: toBase64(salt), iterations };
}

export async function verifyPin(pin, stored) {
  if (!stored?.hash) return false;
  const again = await hashPin(pin, { salt: fromBase64(stored.salt), iterations: stored.iterations });
  return safeEqual(again.hash, stored.hash);
}
