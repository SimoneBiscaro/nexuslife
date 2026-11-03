import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, createZip, readZip } from '../app/src/backup/zip.js';

const enc = new TextEncoder();
const dec = new TextDecoder();

test('CRC32 con vettore di riferimento', () => {
  assert.equal(crc32(enc.encode('123456789')), 0xCBF43926);
  assert.equal(crc32(new Uint8Array()), 0);
});

test('ZIP: scrittura → lettura con nomi UTF-8 e contenuti binari', () => {
  const binary = Uint8Array.from({ length: 70000 }, (_, i) => (i * 31) % 256);
  const files = [
    { name: 'nexuslife.json', data: '{"città":"Però"}' },
    { name: 'csv/vehicle.csv', data: '﻿a;b\r\n1;2\r\n' },
    { name: 'binario.bin', data: binary },
    { name: 'vuoto.txt', data: '' },
  ];
  const zip = createZip(files, { date: new Date(2026, 10, 3, 9, 30, 12) });
  const back = readZip(zip);
  assert.deepEqual(back.map((f) => f.name), files.map((f) => f.name));
  assert.equal(dec.decode(back[0].data), '{"città":"Però"}');
  assert.deepEqual(back[2].data, binary);
  assert.equal(back[3].data.length, 0);
});

test('ZIP: un byte alterato viene scoperto dal CRC', () => {
  const zip = createZip([{ name: 'a.txt', data: 'contenuto importante' }]);
  zip[30 + 'a.txt'.length + 3] ^= 0xFF;
  assert.throws(() => readZip(zip), /CRC/);
  assert.throws(() => readZip(enc.encode('non è uno zip')), /ZIP/);
});

test('ZIP valido anche per unzip di sistema (se presente)', (t) => {
  let ok = true;
  try { execFileSync('unzip', ['-v'], { stdio: 'ignore' }); } catch { ok = false; }
  if (!ok) { t.skip('unzip non disponibile'); return; }
  const dir = mkdtempSync(join(tmpdir(), 'nxzip-'));
  const path = join(dir, 'prova.zip');
  writeFileSync(path, createZip([{ name: 'riepilogo.html', data: '<p>ciao</p>' }, { name: 'csv/bill.csv', data: 'x' }]));
  const out = execFileSync('unzip', ['-t', path]).toString();
  assert.match(out, /No errors detected/);
});
