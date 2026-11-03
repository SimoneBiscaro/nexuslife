import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kmStatus, serviceKmRemainingRatio, serviceStatus } from '../app/src/domain/service.js';

const today = '2026-11-03';
const base = { lastServiceDate: '2026-06-01', lastServiceKm: 30000, serviceIntervalMonths: 12, serviceIntervalKm: 15000 };

test('kmStatus ai confini 0,85 / 0,95 / 1,0', () => {
  assert.equal(kmStatus(0), 'ok');
  assert.equal(kmStatus(0.8499), 'ok');
  assert.equal(kmStatus(0.85), 'warning');
  assert.equal(kmStatus(0.9499), 'warning');
  assert.equal(kmStatus(0.95), 'critical');
  assert.equal(kmStatus(1.0), 'critical');
  assert.equal(kmStatus(1.0001), 'overdue');
  assert.equal(kmStatus(NaN), 'unknown');
});

test('tagliando: prossima data e km', () => {
  const s = serviceStatus({ ...base, currentKm: 36000 }, today);
  assert.equal(s.nextDate, '2027-06-01');
  assert.equal(s.nextKm, 45000);
  assert.equal(s.usedRatio, 0.4);
  assert.equal(s.kmRemaining, 9000);
  assert.equal(s.status, 'ok');
});

test('tagliando: usedRatio esatti 0,85 / 0,95 / 1,0 / oltre', () => {
  const at = (km) => serviceStatus({ ...base, currentKm: km }, today);
  assert.equal(at(42750).kmStatus, 'warning'); // 0,85
  assert.equal(at(44250).kmStatus, 'critical'); // 0,95
  assert.equal(at(45000).kmStatus, 'critical'); // 1,0
  assert.equal(at(45001).kmStatus, 'overdue');
});

test('tagliando: vince lo stato più grave tra data e km', () => {
  // data vicina (critical) ma pochi km (ok)
  const byDate = serviceStatus({ ...base, lastServiceDate: '2025-11-05', currentKm: 31000 }, today);
  assert.equal(byDate.dateStatus, 'critical');
  assert.equal(byDate.kmStatus, 'ok');
  assert.equal(byDate.status, 'critical');
  // data lontana (ok) ma km oltre (overdue)
  const byKm = serviceStatus({ ...base, currentKm: 46000 }, today);
  assert.equal(byKm.dateStatus, 'ok');
  assert.equal(byKm.status, 'overdue');
});

test('tagliando con dati mancanti', () => {
  assert.equal(serviceStatus({ currentKm: 1000 }, today).status, 'unknown');
  const onlyDate = serviceStatus({ lastServiceDate: '2026-06-01', currentKm: 1000 }, today);
  assert.equal(onlyDate.status, 'ok');
  assert.equal(onlyDate.kmStatus, 'unknown');
  assert.equal(onlyDate.nextKm, null);
});

test('tagliando: data stimata dai km e data effettiva', () => {
  const s = serviceStatus({ ...base, currentKm: 44000 }, today, { kmPerDay: 50 });
  assert.equal(s.estimatedKmDate, '2026-11-23'); // 1000 km / 50 = 20 giorni
  assert.equal(s.effectiveDate, '2026-11-23');
  const slow = serviceStatus({ ...base, currentKm: 31000 }, today, { kmPerDay: 10 });
  assert.equal(slow.effectiveDate, '2027-06-01');
});

test('porzione km rimanente per il gauge', () => {
  assert.equal(serviceKmRemainingRatio(0.25), 0.75);
  assert.equal(serviceKmRemainingRatio(1.2), 0);
  assert.equal(serviceKmRemainingRatio(null), 0);
});
