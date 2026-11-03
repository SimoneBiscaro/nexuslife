import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupe, normalizePlate } from '../app/src/domain/dedupe.js';

const NOW = '2026-11-03T12:00:00.000Z';
const rec = (entity, id, fields = {}, updatedAt = '2026-11-01T00:00:00.000Z') =>
  ({ entity, id, createdAt: '2026-10-01T00:00:00.000Z', updatedAt, deleted: false, ...fields });
const find = (out, entity, id) => out.find((r) => r.entity === entity && r.id === id);

test('targa normalizzata', () => {
  assert.equal(normalizePlate(' gh 123-xy '), 'GH123XY');
});

test('nessun duplicato → nessuna modifica', () => {
  assert.deepEqual(dedupe([rec('vehicle', 'a', { plate: 'AA111AA' }), rec('vehicle', 'b', { plate: 'BB222BB' })], NOW), []);
});

test('veicoli per targa: il perdente diventa tombstone e i figli passano al vincitore', () => {
  const records = [
    rec('vehicle', 'v1', { plate: 'GH 123 XY' }, '2026-11-02T00:00:00.000Z'),
    rec('vehicle', 'v2', { plate: 'gh123xy' }, '2026-11-01T00:00:00.000Z'),
    rec('mileageReading', 'm1', { vehicleId: 'v2', km: 1000 }),
    rec('vehicleExpense', 'e1', { vehicleId: 'v2' }),
  ];
  const out = dedupe(records, NOW);
  assert.equal(find(out, 'vehicle', 'v2').deleted, true);
  assert.equal(find(out, 'vehicle', 'v2').updatedAt, NOW);
  assert.equal(find(out, 'vehicle', 'v1'), undefined);
  assert.equal(find(out, 'mileageReading', 'm1').vehicleId, 'v1');
  assert.equal(find(out, 'vehicleExpense', 'e1').vehicleId, 'v1');
});

test('scadenze auto per (veicolo, tipo), anche dopo la fusione dei veicoli', () => {
  const records = [
    rec('vehicle', 'v1', { plate: 'AA111AA' }, '2026-11-02T00:00:00.000Z'),
    rec('vehicle', 'v2', { plate: 'AA111AA' }),
    rec('vehicleDeadline', 'd1', { vehicleId: 'v1', type: 'bollo', dueDate: '2026-12-01' }, '2026-11-01T00:00:00.000Z'),
    rec('vehicleDeadline', 'd2', { vehicleId: 'v2', type: 'bollo', dueDate: '2027-12-01' }, '2026-11-02T00:00:00.000Z'),
    rec('vehicleDeadline', 'd3', { vehicleId: 'v1', type: 'revisione' }),
  ];
  const out = dedupe(records, NOW);
  assert.equal(find(out, 'vehicleDeadline', 'd1').deleted, true);
  assert.equal(find(out, 'vehicleDeadline', 'd2').deleted, false);
  assert.equal(find(out, 'vehicleDeadline', 'd2').vehicleId, 'v1');
  assert.equal(find(out, 'vehicleDeadline', 'd3'), undefined);
});

test('rate per (contratto, periodKey): vince la pagata', () => {
  const records = [
    rec('rentInstallment', 'r1', { contractId: 'c', periodKey: '2026-11' }, '2026-11-03T00:00:00.000Z'),
    rec('rentInstallment', 'r2', { contractId: 'c', periodKey: '2026-11', paidAt: '2026-11-02T10:00:00Z' }),
    rec('rentInstallment', 'r3', { contractId: 'c', periodKey: '2026-12' }),
  ];
  const out = dedupe(records, NOW);
  assert.deepEqual(out.map((r) => `${r.id}:${r.deleted}`), ['r1:true']);
});

test('feedback per normName: muted in OR, snooze massimo', () => {
  const records = [
    rec('suggestionFeedback', 'f1', { normName: 'latte', muted: false, snoozeUntil: '2026-11-05' }, '2026-11-02T00:00:00.000Z'),
    rec('suggestionFeedback', 'f2', { normName: 'latte', muted: true, snoozeUntil: '2026-11-08' }),
    rec('suggestionFeedback', 'f3', { normName: 'latte', muted: false, snoozeUntil: null }),
  ];
  const out = dedupe(records, NOW);
  const winner = find(out, 'suggestionFeedback', 'f1');
  assert.equal(winner.muted, true);
  assert.equal(winner.snoozeUntil, '2026-11-08');
  assert.equal(winner.deleted, false);
  assert.equal(find(out, 'suggestionFeedback', 'f2').deleted, true);
  assert.equal(find(out, 'suggestionFeedback', 'f3').deleted, true);
});

test('categorie per normName: vince la predefinita, articoli ricollegati', () => {
  const records = [
    { ...rec('groceryCategory', 'c-custom', { name: 'Freschi', normName: 'freschi', builtin: false }), createdAt: '2026-09-01T00:00:00.000Z' },
    rec('groceryCategory', 'c-builtin', { name: 'Freschi', normName: 'freschi', builtin: true }),
    rec('groceryItem', 'i1', { normName: 'latte', categoryId: 'c-custom', archived: false }),
    rec('groceryPurchase', 'p1', { normName: 'latte', categoryId: 'c-custom' }),
  ];
  const out = dedupe(records, NOW);
  assert.equal(find(out, 'groceryCategory', 'c-custom').deleted, true);
  assert.equal(find(out, 'groceryItem', 'i1').categoryId, 'c-builtin');
  assert.equal(find(out, 'groceryPurchase', 'p1').categoryId, 'c-builtin');
});

test('due seed su due dispositivi: le categorie predefinite convergono sulla più vecchia', () => {
  const a = { ...rec('groceryCategory', 'a', { normName: 'altro', builtin: true }), createdAt: '2026-10-01T00:00:00.000Z' };
  const b = { ...rec('groceryCategory', 'b', { normName: 'altro', builtin: true }), createdAt: '2026-10-02T00:00:00.000Z' };
  assert.deepEqual(dedupe([b, a], NOW).map((r) => r.id), ['b']);
  assert.deepEqual(dedupe([a, b], NOW).map((r) => r.id), ['b']);
});

test('articoli aperti per normName: quantità massima e urgenza più alta', () => {
  const records = [
    rec('groceryItem', 'i1', { normName: 'latte', quantity: 1, urgency: 'urgente', archived: false }),
    rec('groceryItem', 'i2', { normName: 'latte', quantity: 3, urgency: 'scorta', archived: false }, '2026-11-02T00:00:00.000Z'),
    rec('groceryItem', 'i3', { normName: 'latte', quantity: 9, urgency: 'normale', archived: true }),
  ];
  const out = dedupe(records, NOW);
  const winner = find(out, 'groceryItem', 'i2');
  assert.equal(winner.quantity, 3);
  assert.equal(winner.urgency, 'urgente');
  assert.equal(find(out, 'groceryItem', 'i1').deleted, true);
  assert.equal(find(out, 'groceryItem', 'i3'), undefined); // archiviato: non è un duplicato
});

test('i record già eliminati non partecipano', () => {
  const records = [
    rec('vehicle', 'v1', { plate: 'AA111AA' }),
    rec('vehicle', 'v2', { plate: 'AA111AA', deleted: true }),
  ];
  assert.deepEqual(dedupe(records, NOW), []);
});
