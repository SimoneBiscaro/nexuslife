import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectDeadlines, daysLabel, greeting, upcomingDeadlines, vehicleOverview } from '../app/src/domain/overview.js';
import { vehicleGauges } from '../app/src/views/auto/gauges.js';
import { proposedRevisionDate } from '../app/src/domain/deadlines.js';

const today = '2026-11-03';
const vehicle = {
  id: 'v1', name: 'T-Cross', registrationDate: '2022-02-10', currentKm: 44000,
  lastServiceDate: '2025-11-20', lastServiceKm: 30000, serviceIntervalKm: 15000, serviceIntervalMonths: 12,
};
const deadlines = [
  { id: 'd1', vehicleId: 'v1', type: 'bollo', dueDate: '2026-11-20' },
  { id: 'd2', vehicleId: 'v1', type: 'assicurazione', dueDate: '2026-11-08', recurrenceMonths: 12 },
  { id: 'd3', vehicleId: 'v1', type: 'revisione', dueDate: '2028-02-29' },
  { id: 'd4', vehicleId: 'altra', type: 'bollo', dueDate: '2026-11-04' },
];

test('saluto in base all\'ora', () => {
  assert.equal(greeting(5), 'Buongiorno');
  assert.equal(greeting(12), 'Buongiorno');
  assert.equal(greeting(13), 'Buon pomeriggio');
  assert.equal(greeting(17), 'Buon pomeriggio');
  assert.equal(greeting(18), 'Buonasera');
  assert.equal(greeting(2), 'Buonasera');
});

test('etichetta dei giorni', () => {
  assert.equal(daysLabel(0), 'oggi');
  assert.equal(daysLabel(1), 'domani');
  assert.equal(daysLabel(-1), 'ieri');
  assert.equal(daysLabel(5), 'tra 5 giorni');
  assert.equal(daysLabel(-3), '3 giorni fa');
  assert.equal(daysLabel(null), 'data mancante');
});

test('revisione proposta alla creazione del veicolo', () => {
  assert.equal(proposedRevisionDate('2024-03-15', today), '2028-03-31'); // prima revisione ancora futura
  assert.equal(proposedRevisionDate('2022-02-10', today), '2028-02-29'); // 2026-02-28 passata → +24 mesi
  assert.equal(proposedRevisionDate('2018-11-30', today), '2026-11-30'); // 2022 → 2024 → 2026
  assert.equal(proposedRevisionDate('', today), null);
});

test('stato del veicolo: scadenze per tipo e tagliando', () => {
  const ov = vehicleOverview(vehicle, { deadlines, readings: [] }, today);
  assert.equal(ov.deadlines.bollo.status, 'warning');
  assert.equal(ov.deadlines.assicurazione.status, 'critical');
  assert.equal(ov.deadlines.assicurazione.days, 5);
  assert.equal(ov.deadlines.revisione.status, 'ok');
  assert.equal(ov.service.kmStatus, 'warning'); // 14000/15000 = 0,93
  assert.equal(ov.service.status, 'warning');
  assert.equal(ov.kmPerDay.generic, true);
  assert.equal(ov.currentKm, 44000);
});

test('gauge: il tagliando mostra km o giorni, il più grave', () => {
  const byKm = vehicleGauges(vehicleOverview({ ...vehicle, currentKm: 44700 }, { deadlines, readings: [] }, today), vehicle, today);
  const t = byKm.find((g) => g.key === 'tagliando');
  assert.equal(t.status, 'critical');
  assert.equal(t.unit, 'km');
  assert.equal(t.value, '300');
  const byDays = vehicleGauges(vehicleOverview({ ...vehicle, currentKm: 31000 }, { deadlines, readings: [] }, today), vehicle, today);
  const d = byDays.find((g) => g.key === 'tagliando');
  assert.equal(d.unit, 'giorni');
  assert.equal(d.value, '17');
  const over = vehicleGauges(vehicleOverview({ ...vehicle, currentKm: 45500 }, { deadlines, readings: [] }, today), vehicle, today);
  assert.deepEqual([over[3].value, over[3].unit, over[3].status], ['500', 'km oltre', 'overdue']);
});

test('gauge: scadenze mancanti restano sconosciute e vuote', () => {
  const g = vehicleGauges(vehicleOverview({ id: 'v1' }, { deadlines: [], readings: [] }, today), { id: 'v1' }, today);
  assert.deepEqual(g.map((x) => x.key), ['bollo', 'assicurazione', 'revisione', 'tagliando', 'gomme']);
  assert.deepEqual(g.map((x) => x.status), ['unknown', 'unknown', 'unknown', 'unknown', 'unknown']);
  assert.ok(g.every((x) => x.ratio === 0 && x.value === null));
  assert.equal(g[0].sublabel, 'tocca per impostare');
  assert.equal(g[4].sublabel, 'tocca per impostare');
});

test('gauge Gomme: prossimo cambio stagionale o quattro stagioni', () => {
  const ov = (v) => vehicleOverview(v, { deadlines: [], readings: [] }, today);
  const summer = { ...vehicle, tyreType: 'estive' };
  const g = vehicleGauges(ov(summer), summer, today).find((x) => x.key === 'gomme');
  assert.deepEqual([g.value, g.unit, g.status, g.sublabel], ['12', 'giorni', 'warning', 'invernali entro il 15 nov']);
  assert.ok(g.ratio > 0 && g.ratio < 0.1);
  const four = { ...vehicle, tyreType: 'quattroStagioni' };
  const f = vehicleGauges(ov(four), four, today).find((x) => x.key === 'gomme');
  assert.deepEqual([f.value, f.status, f.ratio, f.sublabel], ['4S', 'ok', 1, 'quattro stagioni']);
});

test('gauge: scaduto mostra i giorni passati', () => {
  const g = vehicleGauges(vehicleOverview(vehicle, { deadlines: [{ id: 'x', vehicleId: 'v1', type: 'bollo', dueDate: '2026-11-01' }], readings: [] }, today), vehicle, today);
  assert.deepEqual([g[0].value, g[0].unit, g[0].status, g[0].sublabel], ['2', 'giorni fa', 'overdue', 'scaduto il 1 nov']);
});

test('scadenze di tutte le sezioni e le prossime 5', () => {
  const data = {
    vehicles: [vehicle],
    vehicleDeadlines: deadlines,
    mileageReadings: [],
    rentInstallments: [
      { id: 'r1', periodKey: '2026-11', dueDate: '2026-11-05' },
      { id: 'r2', periodKey: '2026-10', dueDate: '2026-10-05', paidAt: '2026-10-04T10:00:00Z' },
    ],
    bills: [{ id: 'b1', kind: 'luce', dueDate: '2026-10-30' }],
    homeMaintenance: [{ id: 'h1', title: 'Caldaia', intervalMonths: 12, lastDoneDate: '2026-01-15' }],
    medicalVisits: [
      { id: 'm1', type: 'dentista', dateTime: '2026-11-10T08:00:00Z' },
      { id: 'm2', type: 'oculista', dateTime: '2026-10-01T08:00:00Z' },
    ],
    vaccines: [{ id: 'x1', name: 'Tetano', boosterDate: '2027-06-01' }],
  };
  const items = collectDeadlines(data, today);
  const titles = items.map((i) => i.title);
  assert.ok(titles.includes('Affitto novembre 2026'));
  assert.ok(!titles.includes('Affitto ottobre 2026')); // pagata
  assert.ok(!titles.includes('Visita oculista')); // passata
  assert.ok(!items.some((i) => i.date === '2026-11-04')); // scadenza di un altro veicolo
  const bill = items.find((i) => i.title === 'Bolletta Luce');
  assert.deepEqual([bill.status, bill.days, bill.section], ['overdue', -4, 'casa']);

  const next = upcomingDeadlines(items, 5);
  assert.deepEqual(next.map((i) => i.title), [
    'Bolletta Luce', 'Affitto novembre 2026', 'Assicurazione · T-Cross', 'Visita dentista', 'Bollo · T-Cross',
  ]);
});
