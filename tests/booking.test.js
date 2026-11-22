import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBooking, bookingPatch, bookingRatio, bookingState, clearBookingPatch, parseBookedFor, proposedDoneDate, readBooking,
} from '../app/src/domain/booking.js';
import { collectDeadlines, vehicleOverview } from '../app/src/domain/overview.js';
import { proposeRevisionAfter, todayBanners } from '../app/src/domain/deadlines.js';
import { gardenState, autoIssues, issuePenalty, STATUS_PENALTY } from '../app/src/domain/garden.js';
import { buildReminderEvents, reminderTimes } from '../app/src/domain/reminders.js';
import { buildCalendar } from '../app/src/domain/ics.js';
import { dedupe } from '../app/src/domain/dedupe.js';
import { vehicleGauges } from '../app/src/views/auto/gauges.js';
import { tyreChangePatch } from '../app/src/domain/tyres.js';
import { createBackupPackage } from '../app/src/backup/package.js';
import { readBackup, planMerge } from '../app/src/backup/restore.js';
import { readZip } from '../app/src/backup/zip.js';
import { formatCell } from '../app/src/backup/csv.js';

const today = '2026-11-22';
// Tagliando a calendario scaduto il 10/11 e anche oltre i km.
const vehicle = {
  id: 'v1', name: 'T-Cross', plate: 'GH123XY', registrationDate: '2022-02-10', currentKm: 46000,
  lastServiceDate: '2025-11-10', lastServiceKm: 30000, serviceIntervalKm: 15000, serviceIntervalMonths: 12,
  tyreType: 'estive',
};
const deadlines = [
  { id: 'd1', vehicleId: 'v1', type: 'bollo', dueDate: '2026-11-10' },
  { id: 'd2', vehicleId: 'v1', type: 'assicurazione', dueDate: '2026-11-25', recurrenceMonths: 12 },
  { id: 'd3', vehicleId: 'v1', type: 'revisione', dueDate: '2026-11-15' },
];
const booked = (patch) => ({ ...vehicle, ...patch });

test('lettura della prenotazione: data, ora facoltativa, campi per tipo', () => {
  assert.deepEqual(parseBookedFor('2026-11-28'), { date: '2026-11-28', time: null });
  assert.deepEqual(parseBookedFor('2026-11-28T09:00'), { date: '2026-11-28', time: '09:00' });
  assert.equal(parseBookedFor('28/11/2026'), null);
  assert.equal(parseBookedFor(null), null);
  const b = readBooking(booked({ serviceBookedFor: '2026-11-28T09:00', serviceBookedPlace: ' Officina Rossi ', serviceBookedOn: '2026-11-18' }), 'tagliando');
  assert.deepEqual(b, { kind: 'tagliando', date: '2026-11-28', time: '09:00', place: 'Officina Rossi', notes: '', bookedOn: '2026-11-18' });
  assert.equal(readBooking(vehicle, 'tagliando'), null);
  // i campi della revisione valgono solo per una scadenza di tipo revisione
  assert.equal(readBooking({ type: 'bollo', bookedFor: '2026-11-28' }, 'revisione'), null);
  assert.equal(readBooking({ type: 'revisione', bookedFor: '2026-11-28' }, 'revisione').date, '2026-11-28');
  assert.equal(readBooking({ type: 'bollo', bookedFor: '2026-11-28' }, 'bollo'), null);
  assert.throws(() => bookingPatch('bollo', { date: '2026-11-28' }, today));
});

test('prenotazione futura su una scadenza già passata: booked, la scadenza originale resta', () => {
  const ov = vehicleOverview(vehicle, { deadlines: [{ ...deadlines[2], bookedFor: '2026-11-28', bookedOn: '2026-11-20' }] }, today);
  const r = ov.deadlines.revisione;
  assert.equal(r.status, 'booked');
  assert.equal(r.originalStatus, 'overdue');
  assert.equal(r.days, -7); // la scadenza originale è ancora lì
  assert.equal(r.bookingDays, 6);
  assert.equal(r.bookingRatio, 6 / 8);
});

test('tagliando oltre i km (e la data) ma prenotato: booked prevale anche sui km', () => {
  const plain = vehicleOverview(vehicle, { deadlines }, today).service;
  assert.equal(plain.status, 'overdue');
  assert.equal(plain.kmStatus, 'overdue');
  const s = vehicleOverview(booked({ serviceBookedFor: '2026-11-28T09:00', serviceBookedOn: '2026-11-18' }), { deadlines }, today).service;
  assert.equal(s.status, 'booked');
  assert.equal(s.originalStatus, 'overdue');
  assert.equal(s.kmStatus, 'overdue');
  assert.equal(s.kmRemaining, -1000);
  const g = vehicleGauges(vehicleOverview(booked({ serviceBookedFor: '2026-11-28T09:00', serviceBookedOn: '2026-11-18' }), { deadlines }, today),
    booked({ serviceBookedFor: '2026-11-28T09:00' }), today).find((x) => x.key === 'tagliando');
  assert.equal(g.status, 'booked');
  assert.equal(g.value, '6'); // giorni all'appuntamento, non di ritardo
  assert.match(g.sublabel, /prenotato 28\/11 · ore 9:00/);
  assert.equal(g.note, 'scaduto 10/11'); // data e km entrambi scaduti: si mostra la data
  // a calendario ancora in regola ma oltre i km: la riga piccola parla di km
  const kmOnly = booked({ lastServiceDate: '2026-06-01', serviceBookedFor: '2026-11-28' });
  const gk = vehicleGauges(vehicleOverview(kmOnly, { deadlines }, today), kmOnly, today).find((x) => x.key === 'tagliando');
  assert.equal(gk.note, 'scadeva a 45.000 km');
  assert.equal(gk.sublabel, 'prenotato 28/11');
  assert.match(gk.aria, /^Tagliando: prenotato tra 6 giorni, sabato 28 novembre\. Scadenza originale: scadeva a 45\.000 km$/);
});

test('prenotazione oggi: booked con 0 giorni e anello vuoto', () => {
  const s = vehicleOverview(booked({ serviceBookedFor: today, serviceBookedOn: '2026-11-01' }), { deadlines }, today).service;
  assert.equal(s.status, 'booked');
  assert.equal(s.bookingDays, 0);
  assert.equal(s.bookingRatio, 0);
});

test('prenotazione passata non confermata: bookingPast, con gravità di un warning', () => {
  const t = vehicleOverview(booked({ tyreBookedFor: '2026-11-20' }), { deadlines }, today).tyres;
  assert.equal(t.status, 'bookingPast');
  assert.equal(t.originalStatus, 'overdue');
  assert.equal(bookingState({ date: '2026-11-21' }, today), 'bookingPast');
  const g = vehicleGauges(vehicleOverview(booked({ tyreBookedFor: '2026-11-20' }), { deadlines }, today), booked({ tyreBookedFor: '2026-11-20' }), today)
    .find((x) => x.key === 'gomme');
  assert.equal(g.value, 'Fatto?');
  assert.equal(g.status, 'bookingPast');
});

test('annullamento: i campi tornano vuoti e lo stato torna quello della scadenza', () => {
  const patch = bookingPatch('tagliando', { date: '2026-11-28', time: '09:00', place: 'Rossi', notes: '' }, today);
  assert.deepEqual(patch, { serviceBookedFor: '2026-11-28T09:00', serviceBookedPlace: 'Rossi', serviceBookedNotes: '', serviceBookedOn: today });
  // modifica: la data di prenotazione resta la prima
  assert.equal(bookingPatch('tagliando', { date: '2026-11-29' }, '2026-11-25', { bookedOn: today }).serviceBookedOn, today);
  const v = { ...vehicle, ...patch, ...clearBookingPatch('tagliando') };
  assert.equal(readBooking(v, 'tagliando'), null);
  assert.equal(vehicleOverview(v, { deadlines }, today).service.status, 'overdue');
  assert.deepEqual(clearBookingPatch('gomme'), { tyreBookedFor: null, tyreBookedPlace: null, tyreBookedNotes: null, tyreBookedOn: null });
  assert.deepEqual(Object.keys(clearBookingPatch('revisione')), ['bookedFor', 'bookedPlace', 'bookedNotes', 'bookedOn']);
});

test('nessun effetto su bollo e assicurazione', () => {
  const withFields = deadlines.map((d) => ({ ...d, bookedFor: '2026-11-28', bookedOn: today }));
  const ov = vehicleOverview(vehicle, { deadlines: withFields }, today);
  assert.equal(ov.deadlines.bollo.status, 'overdue');
  assert.equal(ov.deadlines.bollo.booking, undefined);
  assert.equal(ov.deadlines.assicurazione.status, 'critical');
  assert.equal(ov.deadlines.revisione.status, 'booked');
  const items = collectDeadlines({ vehicles: [vehicle], vehicleDeadlines: withFields }, today);
  assert.equal(items.find((i) => i.kind === 'bollo').status, 'overdue');
});

test('"Fatto": data proposta = appuntamento, revisione a fine mese + 24, gomme invertite', () => {
  assert.equal(proposedDoneDate({ date: '2026-11-20' }, today), '2026-11-20');
  assert.equal(proposedDoneDate({ date: '2026-11-28' }, today), today);
  assert.equal(proposeRevisionAfter('2026-11-28'), '2028-11-30');
  assert.equal(proposeRevisionAfter('2027-01-03'), '2029-01-31');
  assert.deepEqual(tyreChangePatch(vehicle, '2026-11-20'), { tyreType: 'invernali', tyreChangedAt: '2026-11-20' });
});

test('riempimento: dal giorno della prenotazione, altrimenti ultimi 30 giorni', () => {
  assert.equal(bookingRatio({ date: '2026-12-02', bookedOn: '2026-11-12' }, today), 0.5);
  assert.equal(bookingRatio({ date: '2027-01-22', bookedOn: null }, today), 1);
  assert.equal(bookingRatio({ date: '2026-12-07', bookedOn: null }, today), 0.5);
  assert.equal(bookingRatio(null, today), 0);
  assert.deepEqual(applyBooking({ status: 'ok' }, null, today).originalStatus, 'ok');
});

test('Oggi: la voce prenotata esce dai banner, "Appuntamento" entro 7 giorni, bookingPast nei banner', () => {
  const now = '2026-11-22T08:00:00Z';
  const far = collectDeadlines({ vehicles: [booked({ serviceBookedFor: '2026-12-10' })], vehicleDeadlines: deadlines }, today);
  const sFar = far.find((i) => i.kind === 'tagliando');
  assert.equal(sFar.status, 'booked');
  assert.equal(sFar.date, '2026-12-10');
  assert.ok(!todayBanners(far, { today, now }).some((b) => b.kind === 'tagliando'));

  const near = collectDeadlines({ vehicles: [booked({ serviceBookedFor: '2026-11-28T09:00' })], vehicleDeadlines: deadlines }, today);
  const banners = todayBanners(near, { today, now });
  const appt = banners.find((b) => b.kind === 'tagliando');
  assert.equal(appt.status, 'booked');
  assert.match(appt.title, /^Appuntamento · Tagliando/);
  assert.equal(appt.booking.time, '09:00');
  assert.equal(banners[banners.length - 1].kind, 'tagliando'); // dopo gli avvisi veri

  const past = collectDeadlines({ vehicles: [booked({ tyreBookedFor: '2026-11-20' })], vehicleDeadlines: deadlines }, today);
  const p = todayBanners(past, { today, now }).find((b) => b.kind === 'gomme');
  assert.equal(p.status, 'bookingPast');
  assert.match(p.title, /l'hai fatto\?/);
});

test('Giardino: booked non pesa, bookingPast pesa come un warning', () => {
  assert.equal(STATUS_PENALTY.booked, 0);
  assert.equal(issuePenalty({ status: 'bookingPast' }), STATUS_PENALTY.warning);
  const base = { vehicleDeadlines: deadlines.filter((d) => d.type === 'revisione') };
  const plain = autoIssues({ vehicles: [vehicle], ...base }, today);
  assert.equal(plain.find((i) => i.key.endsWith(':tagliando')).status, 'overdue');
  const issues = autoIssues({ vehicles: [booked({ serviceBookedFor: '2026-11-28', tyreBookedFor: '2026-11-20' })],
    vehicleDeadlines: [{ ...deadlines[2], bookedFor: '2026-11-25' }] }, today);
  const service = issues.find((i) => i.key.endsWith(':tagliando'));
  assert.equal(service.status, 'booked');
  assert.equal(service.title, 'Tagliando prenotato il 28/11');
  assert.equal(issuePenalty(service), 0);
  assert.equal(issues.find((i) => i.key.endsWith(':gomme')).status, 'bookingPast');
  assert.equal(issues.find((i) => i.key.endsWith(':revisione')).status, 'booked');
  const g = gardenState({ vehicles: [booked({ serviceBookedFor: '2026-11-28', tyreBookedFor: '2026-11-28' })],
    vehicleDeadlines: [{ ...deadlines[2], bookedFor: '2026-11-25' }, { ...deadlines[0], dueDate: '2027-06-01' }, { ...deadlines[1], dueDate: '2027-06-01' }] },
  { today, now: '2026-11-22T08:00:00Z', settings: { lastBackupAt: '2026-11-21T08:00:00Z' } });
  assert.equal(g.plants.find((p) => p.id === 'auto').score, 1);
});

test('.ics: evento alla data della prenotazione, preavviso 1 giorno e il giorno stesso', () => {
  const data = { vehicles: [booked({ serviceBookedFor: '2026-11-28T08:00', serviceBookedPlace: 'Officina Rossi', tyreBookedFor: '2026-12-01' })],
    vehicleDeadlines: [{ ...deadlines[2], bookedFor: '2026-11-25T15:30' }] };
  const events = buildReminderEvents(data, { today, reminderHour: 9 });
  const service = events.find((e) => e.uid === 'service-v1');
  assert.equal(service.kind, 'booking');
  assert.equal(service.dateTime, '2026-11-28T07:00:00.000Z'); // 08:00 a Roma
  assert.equal(service.location, 'Officina Rossi');
  // giorno prima alle 9; l'appuntamento è alle 8, quindi il "giorno stesso" è un'ora prima
  assert.deepEqual(service.reminders.map((r) => r.at), ['2026-11-27T08:00:00.000Z', '2026-11-28T06:00:00.000Z']);
  const tyres = events.find((e) => e.uid === 'tyres-v1');
  assert.equal(tyres.date, '2026-12-01');
  assert.equal(tyres.reminders.length, 2);
  const rev = events.find((e) => e.uid === 'vehicleDeadline-d3');
  assert.deepEqual(rev.reminders.map((r) => r.label), ['1 giorno prima', 'il giorno stesso']);
  assert.equal(rev.reminders[1].at, '2026-11-25T08:00:00.000Z'); // 9:00 del giorno stesso, prima delle 15:30
  const ics = buildCalendar([service, tyres], { now: '2026-11-22T08:00:00Z', reminderHour: 9 });
  assert.match(ics, /DTSTART;TZID=Europe\/Rome:20261128T080000/);
  assert.match(ics, /TRIGGER:-PT1380M/);
  assert.match(ics, /TRIGGER:-PT60M/);
  assert.equal((ics.match(/BEGIN:VALARM/g) || []).length, 4);
  assert.match(ics, /LOCATION:Officina Rossi/);
  // una prenotazione passata non genera eventi e non ripristina i preavvisi della scadenza
  assert.ok(!buildReminderEvents({ vehicles: [booked({ serviceBookedFor: '2026-11-20' })] }, { today }).some((e) => e.uid === 'service-v1'));
  assert.equal(reminderTimes({ kind: 'booking', date: '2026-12-01' }).length, 2);
});

test('dedupe: il vincitore senza prenotazione eredita quella del perdente', () => {
  const T1 = '2026-11-20T10:00:00.000Z';
  const T2 = '2026-11-21T10:00:00.000Z';
  const recs = [
    { ...vehicle, entity: 'vehicle', id: 'a', plate: 'GH 123 XY', createdAt: T1, updatedAt: T1, deleted: false, serviceBookedFor: '2026-11-28T09:00', serviceBookedOn: '2026-11-20' },
    { ...vehicle, entity: 'vehicle', id: 'b', createdAt: T1, updatedAt: T2, deleted: false },
    { entity: 'vehicleDeadline', id: 'r1', vehicleId: 'b', type: 'revisione', dueDate: '2026-11-15', createdAt: T1, updatedAt: T1, deleted: false, bookedFor: '2026-11-25' },
    { entity: 'vehicleDeadline', id: 'r2', vehicleId: 'b', type: 'revisione', dueDate: '2026-11-15', createdAt: T1, updatedAt: T2, deleted: false },
  ];
  const out = dedupe(recs, '2026-11-22T00:00:00.000Z');
  const win = out.find((r) => r.id === 'b');
  assert.equal(win.serviceBookedFor, '2026-11-28T09:00');
  assert.equal(win.serviceBookedOn, '2026-11-20');
  assert.equal(out.find((r) => r.id === 'a').deleted, true);
  assert.equal(out.find((r) => r.id === 'r2').bookedFor, '2026-11-25');
  assert.equal(out.find((r) => r.id === 'r1').deleted, true);
});

test('backup: i campi viaggiano nel pacchetto e un pacchetto v3 senza i campi si ripristina', async () => {
  const T = '2026-11-01T10:00:00.000Z';
  const rec = (entity, id, fields) => ({ entity, id, createdAt: T, updatedAt: T, deleted: false, ...fields });
  const opts = { today, now: '2026-11-22T09:00:00.000Z', appVersion: '0.11.0' };
  const withBooking = [
    rec('vehicle', 'v1', { ...vehicle, serviceBookedFor: '2026-11-28T09:00', serviceBookedPlace: 'Officina Rossi', serviceBookedOn: '2026-11-18' }),
    rec('vehicleDeadline', 'd3', { ...deadlines[2], bookedFor: '2026-11-25' }),
  ];
  const pkg = await createBackupPackage(withBooking, opts);
  const files = readZip(pkg.bytes);
  const dec = new TextDecoder();
  const csv = dec.decode(files.find((f) => f.name === 'csv/vehicle.csv').data);
  assert.match(csv, /serviceBookedFor/);
  assert.match(csv, /28\/11\/2026 09:00/);
  const html = dec.decode(files.find((f) => f.name === 'riepilogo.html').data);
  assert.match(html, /Prenotato/);
  assert.match(html, /Officina Rossi/);
  const back = await readBackup(pkg.bytes);
  assert.equal(back.records.find((r) => r.id === 'v1').serviceBookedFor, '2026-11-28T09:00');
  assert.equal(formatCell('2026-11-28T09:00'), '28/11/2026 09:00');

  // pacchetto della Fase 10 (v3) senza i campi nuovi
  const old = { format: 'nexuslife-backup', schemaVersion: 3, appVersion: '0.10.0', exportedAt: T,
    records: [rec('vehicle', 'v1', vehicle), rec('vehicleDeadline', 'd3', deadlines[2])] };
  const oldBack = await readBackup(new TextEncoder().encode(JSON.stringify(old)));
  assert.equal(oldBack.records.length, 2);
  const merged = planMerge([], oldBack.records, '2026-11-22T09:00:00.000Z');
  assert.ok(merged.length >= 2);
  const ov = vehicleOverview(oldBack.records[0], { deadlines: [oldBack.records[1]] }, today);
  assert.equal(ov.service.status, 'overdue');
  assert.equal(ov.service.booking, null);
});
