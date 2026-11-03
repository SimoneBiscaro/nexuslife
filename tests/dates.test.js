import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, addMonths, daysBetween, daysInMonth, endOfMonth, formatDateKey, formatPeriod, isDateKey,
  isLeapYear, periodKeyOf, toDateKey, zonedTimeToUtc,
} from '../app/src/domain/dates.js';

test('isDateKey valida il calendario', () => {
  assert.equal(isDateKey('2028-02-29'), true);
  assert.equal(isDateKey('2026-02-29'), false);
  assert.equal(isDateKey('2026-04-31'), false);
  assert.equal(isDateKey('2026-13-01'), false);
  assert.equal(isDateKey('26-1-1'), false);
});

test('anni bisestili e giorni nel mese', () => {
  assert.equal(isLeapYear(2028), true);
  assert.equal(isLeapYear(2100), false);
  assert.equal(isLeapYear(2000), true);
  assert.equal(daysInMonth(2028, 2), 29);
  assert.equal(daysInMonth(2026, 2), 28);
  assert.equal(daysInMonth(2026, 4), 30);
  assert.equal(daysInMonth(2026, 12), 31);
});

test('daysBetween conta giorni di calendario', () => {
  assert.equal(daysBetween('2026-11-03', '2026-11-03'), 0);
  assert.equal(daysBetween('2026-11-03', '2026-12-03'), 30);
  assert.equal(daysBetween('2026-11-03', '2026-11-02'), -1);
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
  assert.equal(daysBetween('2028-02-28', '2028-03-01'), 2);
  assert.equal(daysBetween('2027-02-28', '2027-03-01'), 1);
});

test('daysBetween attraverso i cambi di ora legale', () => {
  // 29/3/2026: si passa all'ora legale (il giorno dura 23 ore)
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2);
  // 25/10/2026: si torna all'ora solare (il giorno dura 25 ore)
  assert.equal(daysBetween('2026-10-24', '2026-10-26'), 2);
  // 24 ore esatte ma due cambi di data a Roma: 23:30 del 28/3 → 00:30 del 30/3 (ora legale)
  assert.equal(daysBetween(new Date('2026-03-28T22:30:00Z'), new Date('2026-03-29T22:30:00Z')), 2);
  // 23 ore ma un solo cambio di data
  assert.equal(daysBetween(new Date('2026-03-28T23:30:00Z'), new Date('2026-03-29T21:30:00Z')), 0);
});

test('toDateKey usa il fuso di Roma', () => {
  // 23:30 UTC del 28/3 = 00:30 del 29/3 a Roma (ancora ora solare, UTC+1)
  assert.equal(toDateKey(new Date('2026-03-28T23:30:00Z')), '2026-03-29');
  // 22:30 UTC del 30/6 = 00:30 dell'1/7 a Roma (ora legale, UTC+2)
  assert.equal(toDateKey('2026-06-30T22:30:00Z'), '2026-07-01');
  assert.equal(toDateKey('2026-06-30T21:59:00Z'), '2026-06-30');
  assert.equal(toDateKey('2026-11-03'), '2026-11-03');
  assert.equal(toDateKey(null), null);
  assert.throws(() => toDateKey('2026-02-30'));
});

test('addMonths si ferma a fine mese (29–31)', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2028-01-31', 1), '2028-02-29');
  assert.equal(addMonths('2026-01-30', 1), '2026-02-28');
  assert.equal(addMonths('2026-01-29', 1), '2026-02-28');
  assert.equal(addMonths('2026-03-31', 1), '2026-04-30');
  assert.equal(addMonths('2026-08-31', 6), '2027-02-28');
  assert.equal(addMonths('2028-02-29', 12), '2029-02-28');
  assert.equal(addMonths('2026-11-15', 2), '2027-01-15');
  assert.equal(addMonths('2026-01-15', -2), '2025-11-15');
  assert.equal(addMonths('2026-03-31', -1), '2026-02-28');
});

test('endOfMonth, addDays e periodKey', () => {
  assert.equal(endOfMonth('2028-02-10'), '2028-02-29');
  assert.equal(endOfMonth('2026-02-10'), '2026-02-28');
  assert.equal(endOfMonth('2026-04-01'), '2026-04-30');
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.equal(periodKeyOf('2026-11-03'), '2026-11');
});

test('zonedTimeToUtc: le 9:00 di Roma in ora solare e legale', () => {
  assert.equal(zonedTimeToUtc('2026-03-28', 9).toISOString(), '2026-03-28T08:00:00.000Z');
  assert.equal(zonedTimeToUtc('2026-03-29', 9).toISOString(), '2026-03-29T07:00:00.000Z');
  assert.equal(zonedTimeToUtc('2026-10-25', 9).toISOString(), '2026-10-25T08:00:00.000Z');
  assert.equal(zonedTimeToUtc('2026-10-24', 9).toISOString(), '2026-10-24T07:00:00.000Z');
  // 02:30 del 29/3 non esiste: si avanza alle 03:30 (01:30 UTC)
  assert.equal(zonedTimeToUtc('2026-03-29', 2, 30).toISOString(), '2026-03-29T01:30:00.000Z');
});

test('formattazione italiana', () => {
  assert.equal(formatDateKey('2026-11-07'), '07/11/2026');
  assert.equal(formatPeriod('2026-11'), 'novembre 2026');
});
