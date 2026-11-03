import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decryptBytes, deriveKey, encryptBytes, fromBase64, hashPin, randomBytes, sha256Hex, toBase64, verifyPin } from '../app/src/sync/crypto.js';

test('SHA-256 con vettore noto', async () => {
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('base64 andata e ritorno', () => {
  const bytes = randomBytes(1000);
  assert.deepEqual(fromBase64(toBase64(bytes)), bytes);
});

test('PIN: hash PBKDF2 con salt, verifica corretta e sbagliata', async () => {
  const stored = await hashPin('482915', { iterations: 1000 });
  assert.equal(stored.iterations, 1000);
  assert.notEqual(stored.hash, '482915');
  assert.equal(await verifyPin('482915', stored), true);
  assert.equal(await verifyPin('482916', stored), false);
  assert.equal(await verifyPin('482915', null), false);
  const other = await hashPin('482915', { iterations: 1000 });
  assert.notEqual(other.hash, stored.hash, 'salt diverso → hash diverso');
});

test('AES-GCM: cifra e decifra; chiave sbagliata rifiutata', async () => {
  const salt = randomBytes(16);
  const key = await deriveKey('passphrase giusta', salt, 1000);
  const { iv, data } = await encryptBytes(key, new TextEncoder().encode('dati sanitari'));
  assert.equal(new TextDecoder().decode(await decryptBytes(key, iv, data)), 'dati sanitari');
  const wrong = await deriveKey('passphrase sbagliata', salt, 1000);
  await assert.rejects(decryptBytes(wrong, iv, data));
});
