import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBackupPackage, decryptPackage, encryptPackage, isNxbak } from '../app/src/backup/package.js';
import { readZip, createZip } from '../app/src/backup/zip.js';
import { planMerge, planReplace, readBackup, summarize } from '../app/src/backup/restore.js';
import { parseCsv } from '../app/src/backup/csv.js';

const T = '2026-11-01T10:00:00.000Z';
const rec = (entity, id, fields = {}, updatedAt = T) => ({ entity, id, createdAt: T, updatedAt, deleted: false, ...fields });
const records = [
  rec('vehicle', 'v1', { name: 'T-Cross', plate: 'GH123XY', currentKm: 44000, color: 'Grigio' }),
  rec('vehicleDeadline', 'd1', { vehicleId: 'v1', type: 'bollo', dueDate: '2026-11-20', amount: 210.5 }),
  rec('bill', 'b1', { kind: 'luce', dueDate: '2026-11-05', amount: 80.4, provider: 'Enel; mercato "libero"' }),
  rec('groceryItem', 'g1', { name: 'Caffè', normName: 'caffe', quantity: 2, urgency: 'urgente', archived: false }),
  rec('medicalVisit', 'm1', { type: 'dentista', dateTime: '2026-11-20T08:00:00.000Z', doctor: 'Rossi', notes: 'riga1\nriga2' }),
  rec('vaccine', 'x1', { name: 'Tetano', date: '2020-05-01', boosterDate: '2030-05-01' }),
  rec('bill', 'gone', { kind: 'gas', dueDate: '2026-10-01', amount: 10 }, T),
].map((r) => (r.id === 'gone' ? { ...r, deleted: true } : r));
const opts = { today: '2026-11-03', now: '2026-11-03T09:00:00.000Z', appVersion: '0.5.0' };
const dec = new TextDecoder();

test('pacchetto: file attesi, manifest con SHA-256, niente tombstone', async () => {
  const pkg = await createBackupPackage(records, opts);
  assert.equal(pkg.filename, 'NexusLife_backup_2026-11-03.zip');
  assert.equal(pkg.recordCount, 6);
  const names = readZip(pkg.bytes).map((f) => f.name);
  assert.deepEqual(names, ['nexuslife.json', 'csv/vehicle.csv', 'csv/vehicleDeadline.csv', 'csv/bill.csv', 'csv/groceryItem.csv',
    'csv/medicalVisit.csv', 'csv/vaccine.csv', 'riepilogo.html', 'manifest.json']);
  assert.ok(pkg.manifest.files.every((f) => /^[0-9a-f]{64}$/.test(f.sha256)));
  const bill = readZip(pkg.bytes).find((f) => f.name === 'csv/bill.csv');
  const rows = parseCsv(dec.decode(bill.data));
  assert.equal(rows.length, 2, 'la bolletta eliminata non va esportata');
  assert.ok(rows[1].includes('Enel; mercato "libero"'));
  assert.ok(rows[1].includes('80,4'));
  const html = dec.decode(readZip(pkg.bytes).find((f) => f.name === 'riepilogo.html').data);
  assert.match(html, /<!doctype html>/);
  assert.match(html, /T-Cross/);
  assert.match(html, /Tetano/);
});

test('"Escludi Salute" toglie visite e vaccini ovunque', async () => {
  const pkg = await createBackupPackage(records, { ...opts, excludeHealth: true });
  const files = readZip(pkg.bytes);
  assert.ok(!files.some((f) => f.name.includes('medicalVisit') || f.name.includes('vaccine')));
  const json = dec.decode(files.find((f) => f.name === 'nexuslife.json').data);
  assert.ok(!json.includes('dentista') && !json.includes('Tetano'));
  assert.ok(!dec.decode(files.find((f) => f.name === 'riepilogo.html').data).includes('Tetano'));
  const back = await readBackup(pkg.bytes);
  assert.equal(back.meta.excludeHealth, true);
});

test('ripristino: lettura e verifica degli hash', async () => {
  const pkg = await createBackupPackage(records, opts);
  const back = await readBackup(pkg.bytes);
  assert.equal(back.kind, 'zip');
  assert.equal(back.verified, true);
  assert.equal(back.records.length, 6);
  assert.deepEqual(summarize(back.records), { Auto: 2, Casa: 1, Spesa: 1, Salute: 2 });
  // file alterato ma CRC ricalcolato: lo scopre lo SHA-256 del manifest
  const files = readZip(pkg.bytes).map((f) => (f.name === 'nexuslife.json'
    ? { name: f.name, data: new TextEncoder().encode(dec.decode(f.data).replace('T-Cross', 'T-Rocc')) } : f));
  await assert.rejects(readBackup(createZip(files)), /Verifica fallita: nexuslife.json/);
});

test('ripristino da nexuslife.json da solo', async () => {
  const pkg = await createBackupPackage(records, opts);
  const json = readZip(pkg.bytes).find((f) => f.name === 'nexuslife.json').data;
  const back = await readBackup(json);
  assert.equal(back.kind, 'json');
  assert.equal(back.verified, false);
  assert.equal(back.records.length, 6);
  await assert.rejects(readBackup(new TextEncoder().encode('{"ciao":1}')), /non è un backup/);
});

test('.nxbak: andata e ritorno, passphrase richiesta e sbagliata', async () => {
  const pkg = await createBackupPackage(records, opts);
  const locked = await encryptPackage(pkg.bytes, 'cavallo batteria graffetta', { iterations: 1000 });
  assert.equal(isNxbak(locked), true);
  assert.deepEqual(await decryptPackage(locked, 'cavallo batteria graffetta'), pkg.bytes);
  await assert.rejects(readBackup(locked), (e) => e.code === 'passphrase');
  await assert.rejects(readBackup(locked, { passphrase: 'sbagliata' }), /Passphrase errata/);
  const back = await readBackup(locked, { passphrase: 'cavallo batteria graffetta' });
  assert.equal(back.kind, 'nxbak');
  assert.equal(back.records.length, 6);
});

test('Unisci: vince il più recente per record, poi dedupe', () => {
  const NOW = '2026-11-03T12:00:00.000Z';
  const local = [
    rec('bill', 'b1', { amount: 99 }, '2026-11-02T00:00:00.000Z'), // locale più recente: resta
    rec('vaccine', 'x1', { name: 'Tetano', lot: 'A' }, '2026-10-01T00:00:00.000Z'), // pacchetto più recente: vince
    rec('vehicle', 'vLocal', { plate: 'GH123XY' }, '2026-11-02T00:00:00.000Z'), // stessa targa di v1
  ];
  const incoming = [
    rec('bill', 'b1', { amount: 80.4 }, '2026-11-01T00:00:00.000Z'),
    rec('vaccine', 'x1', { name: 'Tetano', lot: 'B' }, '2026-11-01T00:00:00.000Z'),
    rec('vehicle', 'v1', { plate: 'gh 123 xy' }, '2026-11-01T00:00:00.000Z'),
    rec('groceryItem', 'new', { name: 'Pane' }),
  ];
  const out = planMerge(local, incoming, NOW);
  const get = (id) => out.find((r) => r.id === id);
  assert.equal(get('b1'), undefined);
  assert.equal(get('x1').lot, 'B');
  assert.equal(get('new').name, 'Pane');
  // il veicolo del pacchetto è un doppione per targa: diventa tombstone, vince il locale più recente
  assert.equal(get('v1').deleted, true);
  assert.equal(get('vLocal'), undefined);
});

test('Sostituisci tutto: locali in tombstone, pacchetto con updatedAt nuovo', () => {
  const NOW = '2026-11-03T12:00:00.000Z';
  const local = [
    rec('bill', 'b1', { amount: 99 }, '2026-11-05T00:00:00.000Z'),
    rec('bill', 'only-local', { amount: 1 }),
    rec('bill', 'old-tomb', { amount: 1, deleted: true }),
  ];
  const incoming = [rec('bill', 'b1', { amount: 80.4 }), rec('vaccine', 'x1', { name: 'Tetano' })];
  const out = planReplace(local, incoming, NOW);
  const get = (id) => out.find((r) => r.id === id);
  assert.equal(get('b1').amount, 80.4);
  assert.equal(get('b1').updatedAt, '2026-11-05T00:00:00.001Z', 'deve superare la versione locale');
  assert.equal(get('x1').updatedAt, NOW);
  assert.deepEqual([get('only-local').deleted, get('only-local').updatedAt], [true, NOW]);
  assert.equal(get('old-tomb'), undefined);
});

test('Fase 9: nuove entità nel pacchetto, visite da prenotare escluse con "Escludi Salute"', async () => {
  const more = [
    ...records,
    rec('vehicleMaintenance', 'vm1', { vehicleId: 'v1', title: 'Cambio olio', intervalMonths: 12, intervalKm: 15000, lastDoneDate: '2026-01-10', lastDoneKm: 35000 }),
    rec('vehiclePurchase', 'vp1', { vehicleId: 'v1', name: 'Catene da neve', priority: 'alta', estimatedPrice: 45, done: false }),
    rec('homeMaintenance', 'hm1', { title: 'Rubinetto', dueDate: '2026-11-20', doneAt: null }),
    rec('visitPlan', 'vp-oc', { type: 'oculista', dueBy: '2026-12-01' }),
  ];
  const pkg = await createBackupPackage(more, opts);
  const names = readZip(pkg.bytes).map((f) => f.name);
  assert.ok(['csv/vehicleMaintenance.csv', 'csv/vehiclePurchase.csv', 'csv/homeMaintenance.csv', 'csv/visitPlan.csv'].every((n) => names.includes(n)));
  const html = dec.decode(readZip(pkg.bytes).find((f) => f.name === 'riepilogo.html').data);
  assert.match(html, /Cambio olio/);
  assert.match(html, /Catene da neve/);
  assert.match(html, /una tantum/);
  assert.match(html, /Oculista/);
  const back = await readBackup(pkg.bytes);
  assert.equal(back.meta.schemaVersion, 3);
  assert.deepEqual(summarize(back.records), { Auto: 4, Casa: 2, Spesa: 1, Salute: 3 });
  const noHealth = await createBackupPackage(more, { ...opts, excludeHealth: true });
  assert.ok(!readZip(noHealth.bytes).some((f) => f.name.includes('visitPlan')));
  assert.ok(!dec.decode(readZip(noHealth.bytes).find((f) => f.name === 'riepilogo.html').data).includes('Oculista'));
});

test('un pacchetto di una versione più recente viene rifiutato con un messaggio chiaro', async () => {
  const doc = { format: 'nexuslife-backup', schemaVersion: 99, records: [] };
  await assert.rejects(readBackup(new TextEncoder().encode(JSON.stringify(doc))), /versione più recente/);
});
