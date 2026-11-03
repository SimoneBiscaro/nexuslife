import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReminderEvents, reminderTimes } from '../app/src/domain/reminders.js';

const at = (list) => list.map((r) => r.at);

test('auto: 30/7/1 giorni prima e il giorno stesso alle 9:00 di Roma', () => {
  const r = reminderTimes({ kind: 'auto', date: '2026-12-15' });
  assert.deepEqual(r.map((x) => x.label), ['30 giorni prima', '7 giorni prima', '1 giorno prima', 'il giorno stesso']);
  assert.deepEqual(at(r), [
    '2026-11-15T08:00:00.000Z', '2026-12-08T08:00:00.000Z', '2026-12-14T08:00:00.000Z', '2026-12-15T08:00:00.000Z',
  ]);
  assert.deepEqual(r.map((x) => x.minutesBefore), [30 * 1440, 7 * 1440, 1440, 0]);
});

test('preavvisi a cavallo del cambio d\'ora restano alle 9:00 locali', () => {
  // scadenza il 10/4 (ora legale), preavviso a 30 giorni l'11/3 (ora solare)
  const r = reminderTimes({ kind: 'auto', date: '2026-04-10' });
  assert.equal(r[0].at, '2026-03-11T08:00:00.000Z');
  assert.equal(r[3].at, '2026-04-10T07:00:00.000Z');
  assert.equal(r[0].minutesBefore, 30 * 1440 - 60);
});

test('affitto e bollette: 3 giorni prima e il giorno stesso', () => {
  assert.deepEqual(at(reminderTimes({ kind: 'rent', date: '2026-11-30' })), ['2026-11-27T08:00:00.000Z', '2026-11-30T08:00:00.000Z']);
  assert.deepEqual(reminderTimes({ kind: 'bill', date: '2026-11-30' }).map((x) => x.label), ['3 giorni prima', 'il giorno stesso']);
});

test('manutenzioni 7 giorni, richiami vaccino 30 e 7 giorni', () => {
  assert.deepEqual(at(reminderTimes({ kind: 'homeMaintenance', date: '2026-12-01' })), ['2026-11-24T08:00:00.000Z']);
  assert.deepEqual(reminderTimes({ kind: 'vaccine', date: '2027-01-31' }).map((x) => x.label), ['30 giorni prima', '7 giorni prima']);
});

test('visite: 24 ore e 2 ore prima', () => {
  const r = reminderTimes({ kind: 'medicalVisit', dateTime: '2026-11-20T15:30:00.000Z' });
  assert.deepEqual(at(r), ['2026-11-19T15:30:00.000Z', '2026-11-20T13:30:00.000Z']);
  assert.deepEqual(r.map((x) => x.minutesBefore), [1440, 120]);
});

test('ora del promemoria personalizzabile', () => {
  assert.equal(reminderTimes({ kind: 'rent', date: '2026-07-10' }, { reminderHour: 20 })[1].at, '2026-07-10T18:00:00.000Z');
});

test('eventi da esportare, ordinati e da oggi in poi', () => {
  const today = '2026-11-03';
  const data = {
    vehicles: [{ id: 'v1', name: 'T-Cross', currentKm: 20000, lastServiceDate: '2026-02-10', lastServiceKm: 10000, serviceIntervalMonths: 12, serviceIntervalKm: 15000 }],
    vehicleDeadlines: [
      { id: 'd1', vehicleId: 'v1', type: 'bollo', dueDate: '2026-11-30' },
      { id: 'd2', vehicleId: 'v1', type: 'revisione', dueDate: '2026-10-31' }, // passata: esclusa
      { id: 'd3', vehicleId: 'v1', type: 'assicurazione', dueDate: '2026-12-10', deleted: true },
    ],
    rentInstallments: [
      { id: 'r1', periodKey: '2026-11', dueDate: '2026-11-05' },
      { id: 'r2', periodKey: '2026-12', dueDate: '2026-12-05', paidAt: '2026-11-01T10:00:00Z' },
    ],
    bills: [{ id: 'b1', kind: 'luce', dueDate: '2026-11-20' }],
    homeMaintenance: [{ id: 'h1', title: 'Caldaia', intervalMonths: 12, lastDoneDate: '2025-12-01' }],
    medicalVisits: [{ id: 'm1', type: 'dentista', dateTime: '2026-11-04T09:00:00.000Z' }],
    vaccines: [{ id: 'x1', name: 'Tetano', boosterDate: '2027-03-01' }],
  };
  const events = buildReminderEvents(data, { today });
  assert.deepEqual(events.map((e) => e.title), [
    'Visita: dentista', 'Affitto novembre 2026', 'Bolletta luce', 'Bollo – T-Cross', 'Manutenzione: Caldaia',
    'Tagliando – T-Cross', 'Richiamo vaccino: Tetano',
  ]);
  const service = events.find((e) => e.uid === 'service-v1');
  assert.equal(service.date, '2027-02-10');
  assert.equal(events.find((e) => e.uid === 'rentInstallment-r1').reminders.length, 2);
});
