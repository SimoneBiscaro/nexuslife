import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deadlineStatus, dismissBanner, firstRevisionDate, maintenanceNextDate, proposeRenewal, remainingRatio,
  todayBanners, worstStatus,
} from '../app/src/domain/deadlines.js';
import { addDays } from '../app/src/domain/dates.js';

const today = '2026-11-03';
const inDays = (d) => addDays(today, d);

test('stato scadenza ai confini d = 31/30/8/7/0/−1', () => {
  assert.equal(deadlineStatus(inDays(31), today), 'ok');
  assert.equal(deadlineStatus(inDays(30), today), 'warning');
  assert.equal(deadlineStatus(inDays(8), today), 'warning');
  assert.equal(deadlineStatus(inDays(7), today), 'critical');
  assert.equal(deadlineStatus(inDays(0), today), 'critical');
  assert.equal(deadlineStatus(inDays(-1), today), 'overdue');
  assert.equal(deadlineStatus(null, today), 'unknown');
  assert.equal(deadlineStatus('', today), 'unknown');
});

test('stato scadenza con oggi come istante a cavallo della mezzanotte di Roma', () => {
  // 23:30 UTC del 2/11 = 00:30 del 3/11 a Roma
  assert.equal(deadlineStatus('2026-11-02', new Date('2026-11-02T23:30:00Z')), 'overdue');
  assert.equal(deadlineStatus('2026-11-03', new Date('2026-11-02T23:30:00Z')), 'critical');
});

test('worstStatus sceglie il più grave', () => {
  assert.equal(worstStatus('ok', 'warning'), 'warning');
  assert.equal(worstStatus('unknown', 'ok'), 'ok');
  assert.equal(worstStatus('critical', 'overdue', 'ok'), 'overdue');
  assert.equal(worstStatus('unknown', 'unknown'), 'unknown');
  assert.equal(worstStatus(), 'unknown');
});

test('rinnovi proposti: bollo e assicurazione', () => {
  assert.equal(proposeRenewal({ type: 'bollo', dueDate: '2026-11-30' }), '2027-11-30');
  assert.equal(proposeRenewal({ type: 'assicurazione', dueDate: '2026-11-15' }), '2027-11-15');
  assert.equal(proposeRenewal({ type: 'assicurazione', dueDate: '2026-11-15', recurrenceMonths: 6 }), '2027-05-15');
  assert.equal(proposeRenewal({ type: 'assicurazione', dueDate: '2026-08-31', recurrenceMonths: 6 }), '2027-02-28');
  assert.equal(proposeRenewal({ type: 'bollo', dueDate: '2028-02-29' }), '2029-02-28');
  assert.equal(proposeRenewal({ type: 'bollo' }), null);
});

test('revisione: prima a fine mese di immatricolazione + 4 anni, poi +24 mesi', () => {
  const vehicle = { registrationDate: '2022-02-10' };
  assert.equal(firstRevisionDate('2022-02-10'), '2026-02-28');
  assert.equal(firstRevisionDate('2024-02-29'), '2028-02-29');
  assert.equal(proposeRenewal({ type: 'revisione' }, vehicle), '2026-02-28');
  assert.equal(proposeRenewal({ type: 'revisione', dueDate: '2026-02-28' }, vehicle), '2028-02-29');
  assert.equal(proposeRenewal({ type: 'revisione', dueDate: '2028-02-29' }, vehicle), '2030-02-28');
  assert.equal(proposeRenewal({ type: 'revisione', dueDate: '2026-04-30' }, {}), '2028-04-30');
});

test('remainingRatio: l\'anello si svuota con il tempo', () => {
  assert.equal(remainingRatio('2027-11-03', 12, today), 1);
  assert.equal(remainingRatio(today, 12, today), 0);
  assert.equal(remainingRatio('2026-10-01', 12, today), 0);
  const half = remainingRatio('2027-05-04', 12, today);
  assert.ok(half > 0.49 && half < 0.51, `atteso ~0,5, ottenuto ${half}`);
  assert.equal(remainingRatio(null, 12, today), 0);
});

test('manutenzione casa: ultima esecuzione + intervallo', () => {
  assert.equal(maintenanceNextDate({ lastDoneDate: '2026-05-31', intervalMonths: 6 }), '2026-11-30');
  assert.equal(maintenanceNextDate({ intervalMonths: 6 }), null);
});

test('banner di Oggi: filtro, ordine per gravità poi data, nascosti 24 h', () => {
  const now = '2026-11-03T10:00:00Z';
  const items = [
    { key: 'a', status: 'ok', date: inDays(40) },
    { key: 'b', status: 'warning', date: inDays(20) },
    { key: 'c', status: 'critical', date: inDays(5) },
    { key: 'd', status: 'overdue', date: inDays(-10) },
    { key: 'e', status: 'critical', date: inDays(2) },
    { key: 'f', status: 'warning', date: inDays(31) },
    { key: 'g', status: 'unknown', date: null },
  ];
  assert.deepEqual(todayBanners(items, { today, now }).map((i) => i.key), ['d', 'e', 'c', 'b']);
  const dismissed = dismissBanner({}, 'e', now);
  assert.equal(dismissed.e, '2026-11-04T10:00:00.000Z');
  assert.deepEqual(todayBanners(items, { today, now, dismissed }).map((i) => i.key), ['d', 'c', 'b']);
  // dopo 24 ore ricompare
  assert.deepEqual(todayBanners(items, { today, now: '2026-11-04T10:00:01Z', dismissed }).map((i) => i.key), ['d', 'e', 'c', 'b']);
  // le voci scadute vengono ripulite
  assert.deepEqual(Object.keys(dismissBanner(dismissed, 'b', '2026-11-05T00:00:00Z')), ['b']);
});
