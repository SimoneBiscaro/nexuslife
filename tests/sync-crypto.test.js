import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createVault, decryptRecord, DecryptError, deriveKey, encryptRecord, fromBase64, openVault,
  PBKDF2_ITERATIONS, randomBytes, VAULT_CHECK, WrongPassphrase,
} from '../app/src/sync/crypto.js';

const FAST = { iterations: 1000 }; // nei test: meno iterazioni, stessa logica
const record = {
  id: '3f2a8c1e-0000-4000-8000-000000000001', entity: 'medicalVisit', createdAt: '2026-11-01T08:00:00.000Z',
  updatedAt: '2026-11-02T08:00:00.000Z', deleted: false, type: 'dentista', doctor: 'Dott.ssa Rossi', notes: 'Controllo carie',
};

test('vault: chiave AES-GCM 256 non estraibile, derivata con PBKDF2 a 600.000 iterazioni', async () => {
  const { key, vault } = await createVault('una frase lunga e segreta');
  assert.equal(vault.iterations, PBKDF2_ITERATIONS);
  assert.equal(PBKDF2_ITERATIONS, 600_000);
  assert.equal(key.extractable, false);
  assert.equal(key.algorithm.name, 'AES-GCM');
  assert.equal(key.algorithm.length, 256);
  assert.deepEqual([...key.usages].sort(), ['decrypt', 'encrypt']);
  assert.equal(fromBase64(vault.salt).length, 16);
  assert.ok(!vault.verifier.includes(VAULT_CHECK), 'il verifier è cifrato');
});

test('vault: la passphrase giusta apre, quella sbagliata no', async () => {
  const { key, vault } = await createVault('cavallo batteria graffetta', FAST);
  const again = await openVault('cavallo batteria graffetta', vault);
  // stessa chiave: un record cifrato con la prima si decifra con la seconda
  assert.deepEqual(await decryptRecord(again, { entity: record.entity, id: record.id, ...(await encryptRecord(key, record)) }), record);
  await assert.rejects(openVault('cavallo batteria graffetta!', vault), WrongPassphrase);
  await assert.rejects(openVault('x', { ...vault, verifier: 'rotto' }), /Vault non valido/);
});

test('vault: due vault con la stessa passphrase hanno salt e verifier diversi', async () => {
  const a = await createVault('stessa passphrase', FAST);
  const b = await createVault('stessa passphrase', FAST);
  assert.notEqual(a.vault.salt, b.vault.salt);
  assert.notEqual(a.vault.verifier, b.vault.verifier);
  await assert.rejects(openVault('stessa passphrase', { ...a.vault, salt: b.vault.salt }), WrongPassphrase);
});

test('record: round-trip con IV casuale da 12 byte, nessun testo in chiaro nel payload', async () => {
  const key = await deriveKey('passphrase', randomBytes(16), 1000);
  const one = await encryptRecord(key, record);
  const two = await encryptRecord(key, record);
  assert.equal(fromBase64(one.iv).length, 12);
  assert.notEqual(one.iv, two.iv, 'IV diverso a ogni cifratura');
  assert.notEqual(one.payload, two.payload);
  const raw = new TextDecoder().decode(fromBase64(one.payload));
  for (const secret of ['dentista', 'Rossi', 'carie', 'medicalVisit']) assert.ok(!raw.includes(secret), `"${secret}" in chiaro`);
  assert.deepEqual(await decryptRecord(key, { entity: record.entity, id: record.id, ...one }), record);
});

test('record: chiave sbagliata, payload alterato o spostato su un altro id vengono rifiutati', async () => {
  const key = await deriveKey('giusta', randomBytes(16), 1000);
  const wrong = await deriveKey('sbagliata', randomBytes(16), 1000);
  const enc = await encryptRecord(key, record);
  const row = { entity: record.entity, id: record.id, ...enc };
  await assert.rejects(decryptRecord(wrong, row), DecryptError);

  const bytes = fromBase64(enc.payload);
  bytes[5] ^= 1;
  const tampered = { ...row, payload: Buffer.from(bytes).toString('base64') };
  await assert.rejects(decryptRecord(key, tampered), DecryptError);

  // il server non può scambiare il contenuto tra due righe: entità e id sono legati al cifrato
  await assert.rejects(decryptRecord(key, { ...row, id: 'altro-id' }), DecryptError);
  await assert.rejects(decryptRecord(key, { ...row, entity: 'vaccine' }), DecryptError);
});
