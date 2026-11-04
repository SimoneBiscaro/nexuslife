import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPeriodic, maintenancePlan, markDonePatch, recurrenceLabel, sortMaintenancePlans } from '../app/src/domain/maintenance.js';
import { maintenanceNextDate } from '../app/src/domain/deadlines.js';

const today = '2026-11-04';

test('periodica o una tantum', () => {
  assert.equal(isPeriodic({ intervalMonths: 12 }), true);
  assert.equal(isPeriodic({ intervalKm: 15000 }), true);
  assert.equal(isPeriodic({ intervalMonths: 0, intervalKm: null }), false);
  assert.equal(isPeriodic({}), false);
});

test('cambio olio a mesi o km: vince il più grave', () => {
  const oil = { title: 'Cambio olio', intervalMonths: 12, intervalKm: 15000, lastDoneDate: '2026-03-01', lastDoneKm: 30000 };
  const ok = maintenancePlan(oil, today, { currentKm: 36000, kmPerDay: 30 });
  assert.equal(ok.status, 'ok');
  assert.equal(ok.nextDate, '2027-03-01');
  assert.equal(ok.nextKm, 45000);
  assert.equal(ok.date, '2027-03-01'); // 9.000 km a 30 km/giorno = 300 giorni, dopo marzo
  const km = maintenancePlan(oil, today, { currentKm: 44000, kmPerDay: 30 });
  assert.equal(km.kmStatus, 'warning'); // 14.000 / 15.000 = 0,93
  assert.equal(km.status, 'warning');
  assert.equal(km.date, '2026-12-08'); // 1.000 km a 30 km/giorno = 34 giorni
  const over = maintenancePlan(oil, today, { currentKm: 45500, kmPerDay: 30 });
  assert.equal(over.status, 'overdue');
  assert.equal(over.kmRemaining, -500);
  assert.equal(over.date, today);
});

test('periodica solo a km o solo a mesi', () => {
  const pads = maintenancePlan({ intervalKm: 40000, lastDoneKm: 10000 }, today, { currentKm: 48500, kmPerDay: 20 });
  assert.equal(pads.status, 'critical'); // 0,9625
  assert.equal(pads.nextDate, null);
  const brake = maintenancePlan({ intervalMonths: 24, lastDoneDate: '2024-10-01' }, today, { currentKm: 1 });
  assert.equal(brake.status, 'overdue');
  assert.equal(brake.days, -34);
});

test('periodica mai fatta: stato sconosciuto', () => {
  const p = maintenancePlan({ intervalMonths: 12, intervalKm: 15000 }, today, { currentKm: 40000, kmPerDay: 30 });
  assert.equal(p.status, 'unknown');
  assert.equal(p.date, null);
});

test('una tantum: data facoltativa, fatta = chiusa', () => {
  assert.equal(maintenancePlan({ title: 'Tergicristalli', dueDate: '2026-11-10' }, today).status, 'critical');
  assert.equal(maintenancePlan({ title: 'Tergicristalli' }, today).status, 'unknown');
  const done = maintenancePlan({ title: 'Tergicristalli', dueDate: '2026-11-10', doneAt: '2026-11-03' }, today);
  assert.equal(done.done, true);
  assert.equal(done.status, 'ok');
  assert.equal(done.date, null);
});

test('prossima data a calendario (avvisi e .ics)', () => {
  assert.equal(maintenanceNextDate({ intervalMonths: 6, lastDoneDate: '2026-05-31' }), '2026-11-30');
  assert.equal(maintenanceNextDate({ dueDate: '2026-12-01' }), '2026-12-01');
  assert.equal(maintenanceNextDate({ dueDate: '2026-12-01', doneAt: '2026-11-01' }), null);
  assert.equal(maintenanceNextDate({ intervalKm: 15000, lastDoneKm: 1 }), null);
});

test('"Fatto": data e km per le periodiche, doneAt per le una tantum', () => {
  assert.deepEqual(markDonePatch({ intervalMonths: 12, intervalKm: 15000 }, today, 41000), { lastDoneDate: today, lastDoneKm: 41000 });
  assert.deepEqual(markDonePatch({ intervalMonths: 12 }, today, 41000), { lastDoneDate: today });
  assert.deepEqual(markDonePatch({ title: 'Batteria' }, today, 41000), { doneAt: today });
});

test('ricorrenza a parole', () => {
  assert.equal(recurrenceLabel({ intervalMonths: 12, intervalKm: 15000 }, (n) => `${n} km`), 'ogni 12 mesi o 15000 km');
  assert.equal(recurrenceLabel({ intervalMonths: 1 }), 'ogni 1 mese');
  assert.equal(recurrenceLabel({ intervalKm: 40000 }), 'ogni 40000 km');
  assert.equal(recurrenceLabel({}), 'una tantum');
});

test('ordine: urgenti, poi per data, senza data, fatte in fondo', () => {
  const list = sortMaintenancePlans([
    { id: 'fatta', title: 'A', doneAt: '2026-10-01' },
    { id: 'lontana', title: 'B', dueDate: '2027-06-01' },
    { id: 'senza', title: 'C' },
    { id: 'scaduta', title: 'D', intervalMonths: 12, lastDoneDate: '2025-10-01' },
    { id: 'vicina', title: 'E', dueDate: '2026-11-20' },
    { id: 'eliminata', title: 'F', dueDate: '2026-11-05', deleted: true },
  ], today);
  assert.deepEqual(list.map((x) => x.item.id), ['scaduta', 'vicina', 'lontana', 'senza', 'fatta']);
});
