import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCalendar, escapeText, foldLine } from '../app/src/domain/ics.js';
import { toZonedIcs } from '../app/src/domain/dates.js';

const NOW = '2026-11-03T10:00:00.000Z';
const enc = new TextEncoder();

test('escape del testo', () => {
  assert.equal(escapeText('Bollo, T-Cross; nota\\x\nriga'), 'Bollo\\, T-Cross\; nota\\\\x\\nriga');
});

test('righe piegate a 75 ottetti senza spezzare gli accenti', () => {
  const line = `SUMMARY:${'è'.repeat(80)}`;
  const folded = foldLine(line);
  for (const part of folded.split('\r\n')) assert.ok(enc.encode(part).length <= 75);
  assert.equal(folded.split('\r\n').map((p, i) => (i ? p.slice(1) : p)).join(''), line);
  assert.equal(foldLine('BREVE'), 'BREVE');
});

test('ora locale di Roma per iCalendar (solare e legale)', () => {
  assert.equal(toZonedIcs('2026-07-01T07:00:00Z'), '20260701T090000');
  assert.equal(toZonedIcs('2026-12-01T08:00:00Z'), '20261201T090000');
});

test('calendario conforme: struttura, TZID, UID stabili, allarmi del §7', () => {
  const events = [
    { uid: 'vehicleDeadline-d1', kind: 'auto', title: 'Bollo – T-Cross', date: '2026-11-30', updatedAt: '2026-11-01T00:00:00.000Z' },
    { uid: 'medicalVisit-m1', kind: 'medicalVisit', title: 'Visita: dentista', dateTime: '2026-11-20T14:30:00.000Z', location: 'Studio Rossi, Milano' },
    { uid: 'rentInstallment-r1', kind: 'rent', title: 'Affitto novembre 2026', date: '2026-11-30' },
  ];
  const ics = buildCalendar(events, { now: NOW, reminderHour: 9 });
  const lines = ics.split('\r\n');
  assert.ok(ics.endsWith('\r\n'));
  assert.equal(lines[0], 'BEGIN:VCALENDAR');
  assert.ok(lines.includes('VERSION:2.0'));
  assert.ok(lines.some((l) => l.startsWith('PRODID:')));
  assert.equal(lines.filter((l) => l === 'BEGIN:VTIMEZONE').length, 1);
  assert.equal(lines.filter((l) => l === 'BEGIN:VEVENT').length, 3);
  assert.equal(lines.filter((l) => l === 'BEGIN:VEVENT').length, lines.filter((l) => l === 'END:VEVENT').length);
  assert.ok(lines.includes('UID:vehicleDeadline-d1@nexuslife'));
  assert.ok(lines.includes('DTSTART;TZID=Europe/Rome:20261130T090000'));
  assert.ok(lines.includes('DTSTART;TZID=Europe/Rome:20261120T153000'));
  assert.ok(lines.includes('DTSTAMP:20261103T100000Z'));
  assert.ok(lines.includes('LOCATION:Studio Rossi\\, Milano'));
  // auto: 30/7/1/0 giorni; visite 24 h e 2 h; affitto 3 giorni e giorno stesso
  for (const t of ['TRIGGER:-P30D', 'TRIGGER:-P7D', 'TRIGGER:-P1D', 'TRIGGER:PT0S', 'TRIGGER:-PT24H', 'TRIGGER:-PT2H', 'TRIGGER:-P3D']) {
    assert.ok(lines.includes(t), `manca ${t}`);
  }
  assert.equal(lines.filter((l) => l === 'BEGIN:VALARM').length, 4 + 2 + 2);
  assert.ok(lines.every((l) => enc.encode(l).length <= 75));
});

test('stesso evento modificato: stesso UID, SEQUENCE più alta', () => {
  const a = buildCalendar([{ uid: 'x', kind: 'auto', title: 'A', date: '2026-12-01', updatedAt: '2026-11-01T00:00:00Z' }], { now: NOW });
  const b = buildCalendar([{ uid: 'x', kind: 'auto', title: 'A', date: '2027-12-01', updatedAt: '2026-11-02T00:00:00Z' }], { now: NOW });
  const seq = (s) => Number(/SEQUENCE:(\d+)/.exec(s)[1]);
  assert.ok(seq(b) > seq(a));
  assert.match(a, /UID:x@nexuslife/);
  assert.match(b, /UID:x@nexuslife/);
});
