import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boosterStatus, countdown, sortVaccines, splitVisits } from '../app/src/domain/health.js';
import { backupReminder } from '../app/src/domain/overview.js';

const NOW = '2026-11-03T10:00:00.000Z'; // 11:00 a Roma

test('visite prossime e passate', () => {
  const visits = [
    { id: 'a', dateTime: '2026-11-10T08:00:00Z' },
    { id: 'b', dateTime: '2026-10-01T08:00:00Z' },
    { id: 'c', dateTime: '2026-11-03T15:00:00Z' },
    { id: 'd', dateTime: '2026-09-01T08:00:00Z' },
    { id: 'e', dateTime: '2026-12-01T08:00:00Z', deleted: true },
  ];
  const { upcoming, past } = splitVisits(visits, NOW);
  assert.deepEqual(upcoming.map((v) => v.id), ['c', 'a']);
  assert.deepEqual(past.map((v) => v.id), ['b', 'd']);
});

test('conto alla rovescia', () => {
  assert.equal(countdown('2026-11-03T15:30:00Z', NOW).label, 'oggi, tra 5 h 30 min');
  assert.equal(countdown('2026-11-03T10:20:00Z', NOW).label, 'oggi, tra 20 min');
  assert.equal(countdown('2026-11-04T07:00:00Z', NOW).label, 'domani');
  const far = countdown('2026-11-10T08:00:00Z', NOW);
  assert.equal(far.label, 'tra 7 giorni');
  assert.equal(far.days, 6);
  assert.equal(far.hours, 22);
  assert.equal(countdown('2026-11-01T00:00:00Z', NOW).label, 'adesso');
});

test('stato dei richiami secondo il §7', () => {
  const today = '2026-11-03';
  assert.equal(boosterStatus({ boosterDate: '2027-01-01' }, today), 'ok');
  assert.equal(boosterStatus({ boosterDate: '2026-11-30' }, today), 'warning');
  assert.equal(boosterStatus({ boosterDate: '2026-11-05' }, today), 'critical');
  assert.equal(boosterStatus({ boosterDate: '2026-11-02' }, today), 'overdue');
  assert.equal(boosterStatus({}, today), null);
  assert.deepEqual(sortVaccines([{ id: 1, date: '2020-01-01' }, { id: 2, date: '2024-01-01' }, { id: 3, date: '2025-01-01', deleted: true }]).map((v) => v.id), [2, 1]);
});

test('promemoria backup in Oggi', () => {
  const today = '2026-11-03';
  assert.equal(backupReminder({ lastBackupAt: null, hasData: false }, today), null);
  assert.equal(backupReminder({ lastBackupAt: null, hasData: true }, today).key, 'backup:never');
  assert.equal(backupReminder({ lastBackupAt: '2026-10-04T10:00:00Z', thresholdDays: 30, hasData: true }, today), null);
  const due = backupReminder({ lastBackupAt: '2026-10-03T10:00:00Z', thresholdDays: 30, hasData: true }, today);
  assert.equal(due.days, 31);
  assert.equal(due.title, 'Ultimo backup 31 giorni fa');
  assert.ok(backupReminder({ lastBackupAt: '2026-10-25T10:00:00Z', thresholdDays: 7, hasData: true }, today));
});
