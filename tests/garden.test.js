import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GARDEN_PLANTS, GARDEN_STAGES, SPROUT_STAGE, STAGE_IDS, STATUS_PENALTY,
  issuePenalty, healthScore, stageFor, buildPlant, dueText, sortIssues,
  autoIssues, rentIssues, maintenanceIssues, groceryIssues, healthIssues, backupIssues,
  paymentGardenStatus, gardenState,
} from '../app/src/domain/garden.js';
import { addDays, addMonths } from '../app/src/domain/dates.js';

const today = '2026-11-04';
const now = '2026-11-04T10:00:00Z';
const st = (status, overdueDays = 0) => ({ status, overdueDays });
const stageOf = (issues) => stageFor(healthScore(issues)).id;

/* ---------- Punteggio e stadi ---------- */

test('tutto ok o nessun elemento: punteggio 1, pianta fiorita', () => {
  assert.equal(healthScore([]), 1);
  assert.equal(healthScore([st('ok'), st('ok'), st('unknown')]), 1);
  assert.equal(stageOf([st('ok'), st('ok')]), 'fiorita');
});

test('un elemento per ogni stato dà lo stadio atteso', () => {
  assert.equal(stageOf([st('warning')]), 'sana'); // 0,85
  assert.equal(stageOf([st('critical')]), 'assetata'); // 0,60
  assert.equal(stageOf([st('overdue')]), 'appassita'); // 0,30
  assert.equal(stageOf([st('overdue', 30)]), 'secca'); // 0,05
});

test('ogni stadio si raggiunge e le soglie sono quelle dichiarate', () => {
  assert.deepEqual(STAGE_IDS, ['fiorita', 'sana', 'assetata', 'appassita', 'secca', 'germoglio']);
  assert.equal(stageFor(1).id, 'fiorita');
  assert.equal(stageFor(0.9).id, 'fiorita');
  assert.equal(stageFor(0.899).id, 'sana');
  assert.equal(stageFor(0.7).id, 'sana');
  assert.equal(stageFor(0.699).id, 'assetata');
  assert.equal(stageFor(0.45).id, 'assetata');
  assert.equal(stageFor(0.449).id, 'appassita');
  assert.equal(stageFor(0.2).id, 'appassita');
  assert.equal(stageFor(0.199).id, 'secca');
  assert.equal(stageFor(0).id, 'secca');
});

test('gli stadi peggiorano in modo coerente: più bassi, meno fiori, più foglie cadute', () => {
  for (let i = 1; i < GARDEN_STAGES.length; i++) {
    const a = GARDEN_STAGES[i - 1];
    const b = GARDEN_STAGES[i];
    assert.ok(b.height < a.height, `${b.id} più bassa di ${a.id}`);
    assert.ok(b.flowers <= a.flowers, `${b.id} fiori`);
    assert.ok(b.leaves <= a.leaves, `${b.id} foglie`);
    assert.ok(b.fallen >= a.fallen, `${b.id} foglie cadute`);
    assert.ok(b.droop >= a.droop, `${b.id} piegatura`);
    assert.ok(b.min < a.min);
  }
  assert.equal(GARDEN_STAGES[0].fallen, 0);
  assert.ok(GARDEN_STAGES[0].flowers >= 3);
  assert.equal(GARDEN_STAGES.at(-1).flowers, 0);
});

test('tutto scaduto: pianta secca', () => {
  assert.equal(stageOf([st('overdue'), st('overdue'), st('overdue')]), 'secca');
  assert.equal(healthScore([st('overdue', 90), st('overdue', 60)]) < 0.01, true);
});

test('dati mancanti: germoglio neutro, non pianta secca', () => {
  assert.equal(stageFor(null, false), SPROUT_STAGE);
  const p = buildPlant('auto', [], false);
  assert.equal(p.stage.id, 'germoglio');
  assert.equal(p.score, null);
  assert.equal(p.stage.tone, 'neutral');
  assert.match(p.summary, /germoglio, ancora nessun dato/);
});

test('molti elementi lievi non valgono mai uno grave', () => {
  const tenWarnings = Array.from({ length: 10 }, () => st('warning'));
  const tenCritical = Array.from({ length: 10 }, () => st('critical'));
  assert.ok(healthScore(tenWarnings) >= healthScore([st('critical')]));
  assert.ok(healthScore(tenWarnings) > healthScore([st('overdue')]));
  assert.ok(healthScore(tenCritical) >= healthScore([st('overdue')]));
  assert.equal(stageOf(tenWarnings), 'assetata');
  // ma contano: due lievi sono peggio di uno solo
  assert.ok(healthScore([st('warning'), st('warning')]) < healthScore([st('warning')]));
  assert.equal(stageOf([st('warning'), st('warning')]), 'sana'); // 0,7225
  assert.equal(stageOf([st('warning'), st('warning'), st('warning')]), 'assetata');
});

test('uno scaduto pesa di più con il passare dei giorni, fino al tetto', () => {
  assert.equal(issuePenalty(st('overdue', 0)), STATUS_PENALTY.overdue);
  assert.ok(issuePenalty(st('overdue', 10)) > issuePenalty(st('overdue', 1)));
  assert.equal(issuePenalty(st('overdue', 30)), 0.95);
  assert.equal(issuePenalty(st('overdue', 300)), 0.95);
  assert.equal(issuePenalty(st('warning', 50)), STATUS_PENALTY.warning); // i giorni contano solo per gli scaduti
});

/* ---------- Monotonia ---------- */

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
const ORDER = ['ok', 'warning', 'critical', 'overdue'];
const STAGE_RANK = Object.fromEntries(GARDEN_STAGES.map((s, i) => [s.id, i]));

test('monotonia: aggiungere un problema non rende mai la pianta più sana', () => {
  const rand = rng(42);
  for (let n = 0; n < 2000; n++) {
    const issues = Array.from({ length: Math.floor(rand() * 8) }, () => st(ORDER[Math.floor(rand() * 4)], Math.floor(rand() * 60)));
    const extra = st(ORDER[Math.floor(rand() * 4)], Math.floor(rand() * 60));
    const before = healthScore(issues);
    const after = healthScore([...issues, extra]);
    assert.ok(after <= before, `aggiunta di ${JSON.stringify(extra)} a ${JSON.stringify(issues)}`);
    assert.ok(STAGE_RANK[stageFor(after).id] >= STAGE_RANK[stageFor(before).id]);
  }
});

test('monotonia: peggiorare un elemento non rende mai la pianta più sana', () => {
  const rand = rng(7);
  for (let n = 0; n < 2000; n++) {
    const issues = Array.from({ length: 1 + Math.floor(rand() * 7) }, () => st(ORDER[Math.floor(rand() * 4)], Math.floor(rand() * 60)));
    const i = Math.floor(rand() * issues.length);
    const cur = issues[i];
    const level = ORDER.indexOf(cur.status);
    const worse = level < 3 ? st(ORDER[level + 1 + Math.floor(rand() * (3 - level))], cur.overdueDays) : st('overdue', cur.overdueDays + 1 + Math.floor(rand() * 20));
    const changed = issues.map((x, j) => (j === i ? worse : x));
    assert.ok(healthScore(changed) <= healthScore(issues), `${JSON.stringify(cur)} → ${JSON.stringify(worse)} in ${JSON.stringify(issues)}`);
  }
});

test('le cause sono ordinate per gravità', () => {
  const sorted = sortIssues([st('warning'), st('overdue', 2), st('ok'), st('critical'), st('overdue', 20)]);
  assert.deepEqual(sorted.map((i) => `${i.status}${i.overdueDays || ''}`), ['overdue20', 'overdue2', 'critical', 'warning', 'ok']);
});

/* ---------- Testi ---------- */

test('testi delle scadenze in italiano', () => {
  assert.equal(dueText('Bollo', -3), 'Bollo scaduto da 3 giorni');
  assert.equal(dueText('Bollo', -1), 'Bollo scaduto da 1 giorno');
  assert.equal(dueText('Revisione', -2, true), 'Revisione scaduta da 2 giorni');
  assert.equal(dueText('Bollo', 0), 'Bollo scade oggi');
  assert.equal(dueText('Bollo', 1), 'Bollo scade domani');
  assert.equal(dueText('Bollo', 12), 'Bollo scade tra 12 giorni');
  assert.equal(dueText('Bollo', null), 'Bollo: data mancante');
});

/* ---------- Singole piante ---------- */

const vehicle = {
  id: 'v1', name: 'T-Cross', currentKm: 40000, lastServiceDate: addMonths(today, -6), lastServiceKm: 30000,
  serviceIntervalKm: 15000, serviceIntervalMonths: 12,
};

test('Auto: bollo scaduto da 3 giorni, le altre in regola', () => {
  const issues = autoIssues({
    vehicles: [vehicle],
    vehicleDeadlines: [
      { id: 'b', vehicleId: 'v1', type: 'bollo', dueDate: addDays(today, -3) },
      { id: 'a', vehicleId: 'v1', type: 'assicurazione', dueDate: addDays(today, 200) },
      { id: 'r', vehicleId: 'v1', type: 'revisione', dueDate: addDays(today, 400) },
    ],
    mileageReadings: [],
  }, today);
  assert.equal(issues.length, 4);
  const bollo = issues.find((i) => i.key === 'auto:v1:bollo');
  assert.equal(bollo.status, 'overdue');
  assert.equal(bollo.title, 'Bollo scaduto da 3 giorni');
  assert.equal(bollo.overdueDays, 3);
  assert.equal(bollo.href, '#/auto');
  assert.equal(issues.find((i) => i.key === 'auto:v1:tagliando').status, 'ok'); // 10.000 km su 15.000 = 0,67
  assert.equal(buildPlant('auto', issues, true).stage.id, 'appassita');
});

test('Auto: scadenza mancante = da inserire, non penalizza', () => {
  const issues = autoIssues({ vehicles: [vehicle], vehicleDeadlines: [], mileageReadings: [] }, today);
  assert.deepEqual(issues.filter((i) => i.status === 'unknown').map((i) => i.title),
    ['Bollo: data da inserire', 'Assicurazione: data da inserire', 'Revisione: data da inserire']);
  assert.equal(buildPlant('auto', issues, true).stage.id, 'fiorita');
});

test('Auto: tagliando superato con i km conta come scaduto, il ritardo si stima dai km', () => {
  const v = { ...vehicle, currentKm: 46000 }; // 1000 km oltre
  const readings = [{ id: 'm1', vehicleId: 'v1', date: addDays(today, -60), km: 43000 }, { id: 'm2', vehicleId: 'v1', date: today, km: 46000 }];
  const t = autoIssues({ vehicles: [v], vehicleDeadlines: [], mileageReadings: readings }, today).find((i) => i.key.endsWith('tagliando'));
  assert.equal(t.status, 'overdue');
  assert.equal(t.title, 'Tagliando superato di 1000 km');
  assert.equal(t.overdueDays, 20); // 50 km/giorno
});

test('Affitto e bollette: contano solo dall\'ultima settimana o se scadute', () => {
  assert.equal(paymentGardenStatus(addDays(today, 20), today), 'ok');
  assert.equal(paymentGardenStatus(addDays(today, 5), today), 'critical');
  assert.equal(paymentGardenStatus(addDays(today, -1), today), 'overdue');
  const issues = rentIssues({
    rentInstallments: [
      { id: 'r1', periodKey: '2026-11', dueDate: addDays(today, -2), amount: 450 },
      { id: 'r2', periodKey: '2026-12', dueDate: addDays(today, 28), amount: 450 },
      { id: 'r0', periodKey: '2026-10', dueDate: addDays(today, -32), amount: 450, paidAt: '2026-10-01' },
    ],
    bills: [{ id: 'b1', kind: 'luce', dueDate: addDays(today, 3), amount: 70 }, { id: 'b2', kind: 'gas', dueDate: addDays(today, -1), paidAt: today }],
  }, today);
  assert.deepEqual(issues.map((i) => [i.title, i.status]), [
    ['Rata di novembre 2026 scaduta da 2 giorni', 'overdue'],
    ['Rata di dicembre 2026 scade tra 28 giorni', 'ok'],
    ['Bolletta luce scade tra 3 giorni', 'critical'],
  ]);
});

test('Manutenzioni: in ritardo rispetto all\'intervallo', () => {
  const issues = maintenanceIssues({ homeMaintenance: [
    { id: 'm1', title: 'Caldaia', intervalMonths: 12, lastDoneDate: addDays(addMonths(today, -12), -10) },
    { id: 'm2', title: 'Filtri', intervalMonths: 6, lastDoneDate: addMonths(today, -1) },
    { id: 'm3', title: 'Grondaie', intervalMonths: 12 },
  ] }, today);
  assert.equal(issues[0].title, 'Caldaia in ritardo di 10 giorni');
  assert.equal(issues[0].status, 'overdue');
  assert.equal(issues[1].status, 'ok');
  assert.equal(issues[2].status, 'unknown');
});

test('Spesa: urgenti aperti, rossi se urgenti da più di 2 giorni', () => {
  const issues = groceryIssues({ groceryItems: [
    { id: 'g1', name: 'Latte', urgency: 'urgente', addedAt: '2026-11-04T08:00:00Z' },
    { id: 'g2', name: 'Pane', urgency: 'urgente', addedAt: '2026-11-01T08:00:00Z' },
    { id: 'g3', name: 'Pasta', urgency: 'normale', addedAt: '2026-10-01T08:00:00Z' },
    { id: 'g4', name: 'Uova', urgency: 'urgente', addedAt: '2026-10-01T08:00:00Z', checkedAt: '2026-11-04T09:00:00Z' },
    { id: 'g5', name: 'Sale', urgency: 'urgente', addedAt: '2026-10-01T08:00:00Z', archived: true },
  ] }, now);
  assert.deepEqual(issues.map((i) => [i.title, i.status]), [['Latte urgente da oggi', 'warning'], ['Pane urgente da 3 giorni', 'critical']]);
  assert.equal(buildPlant('spesa', issues, true).stage.id, 'assetata');
});

test('Salute: visite vicine senza preparazione e richiami vaccino', () => {
  const issues = healthIssues({
    medicalVisits: [
      { id: 'v1', type: 'dentista', dateTime: '2026-11-05T09:00:00Z', notes: '' },
      { id: 'v2', type: 'oculista', dateTime: '2026-11-09T09:00:00Z', notes: '' },
      { id: 'v3', type: 'altro', dateTime: '2026-11-06T09:00:00Z', notes: 'Portare gli esami' },
      { id: 'v4', type: 'altro', dateTime: '2026-11-20T09:00:00Z', notes: '' },
      { id: 'v5', type: 'altro', dateTime: '2026-10-20T09:00:00Z', notes: '' },
    ],
    vaccines: [{ id: 'x1', name: 'Tetano', boosterDate: addDays(today, -5) }, { id: 'x2', name: 'Epatite', date: '2020-01-01' }],
  }, today);
  assert.deepEqual(issues.map((i) => [i.title, i.status]), [
    ['Visita dentista domani, senza preparazione', 'critical'],
    ['Visita oculista tra 5 giorni, senza preparazione', 'warning'],
    ['Richiamo Tetano scaduto da 5 giorni', 'overdue'],
  ]);
  assert.equal(issues[0].maskedTitle, 'Visita domani, senza preparazione');
  assert.equal(issues[2].maskedTitle, 'Richiamo vaccino scaduto da 5 giorni');
});

test('Backup: soglia, 2× e 3× la soglia', () => {
  const at = (days) => `${addDays(today, -days)}T10:00:00Z`;
  assert.equal(backupIssues({ lastBackupAt: at(10), thresholdDays: 30 }, today)[0].status, 'ok');
  assert.equal(backupIssues({ lastBackupAt: at(31), thresholdDays: 30 }, today)[0].status, 'warning');
  assert.equal(backupIssues({ lastBackupAt: at(61), thresholdDays: 30 }, today)[0].status, 'critical');
  const old = backupIssues({ lastBackupAt: at(100), thresholdDays: 30 }, today)[0];
  assert.equal(old.status, 'overdue');
  assert.equal(old.overdueDays, 10);
  assert.equal(old.title, 'Ultimo backup 100 giorni fa');
  assert.equal(backupIssues({ lastBackupAt: at(8), thresholdDays: 7 }, today)[0].status, 'warning');
  assert.equal(backupIssues({}, today)[0].status, 'critical');
});

/* ---------- Giardino completo ---------- */

test('giardino vuoto: sei germogli, nessun dato', () => {
  const g = gardenState({}, { today, now });
  assert.deepEqual(g.plants.map((p) => p.id), GARDEN_PLANTS.map((p) => p.id));
  assert.ok(g.plants.every((p) => p.stage.id === 'germoglio'));
  assert.equal(g.hasData, false);
  assert.equal(g.withData, 0);
});

test('giardino: le categorie senza dati restano germogli, le eliminate non contano', () => {
  const g = gardenState({
    vehicles: [{ ...vehicle, deleted: true }],
    groceryItems: [{ id: 'g1', name: 'Latte', urgency: 'urgente', addedAt: '2026-11-04T08:00:00Z' }],
  }, { today, now, settings: { lastBackupAt: '2026-11-01T10:00:00Z', backupReminderDays: 30 } });
  const by = Object.fromEntries(g.plants.map((p) => [p.id, p]));
  assert.equal(by.auto.stage.id, 'germoglio');
  assert.equal(by.spesa.stage.id, 'sana');
  assert.equal(by.spesa.pending, 1);
  assert.equal(by.backup.stage.id, 'fiorita');
  assert.equal(by.salute.stage.id, 'germoglio');
  assert.equal(g.withData, 2);
  assert.equal(g.healthy, 2);
  assert.equal(by.spesa.summary, 'Spesa: sana, 1 cosa in sospeso');
});

/* ---------- Fase 9: gomme, manutenzioni auto e una tantum ---------- */

test('Auto: cambio gomme e manutenzioni dell\'auto fanno soffrire la pianta', () => {
  const data = {
    vehicles: [{ ...vehicle, tyreType: 'estive' }],
    vehicleDeadlines: [
      { id: 'b', vehicleId: 'v1', type: 'bollo', dueDate: addDays(today, 200) },
      { id: 'a', vehicleId: 'v1', type: 'assicurazione', dueDate: addDays(today, 200) },
      { id: 'r', vehicleId: 'v1', type: 'revisione', dueDate: addDays(today, 400) },
    ],
    mileageReadings: [],
    vehicleMaintenance: [
      { id: 'olio', vehicleId: 'v1', title: 'Cambio olio', intervalMonths: 12, intervalKm: 15000, lastDoneDate: addMonths(today, -2), lastDoneKm: 25500 },
      { id: 'terg', vehicleId: 'v1', title: 'Tergicristalli' },
      { id: 'batt', vehicleId: 'v1', title: 'Batteria', dueDate: addDays(today, -1), doneAt: addDays(today, -2) },
      { id: 'altra', vehicleId: 'altra', title: 'Altro veicolo', dueDate: addDays(today, -40) },
    ],
  };
  const issues = autoIssues(data, today);
  const by = Object.fromEntries(issues.map((i) => [i.key, i]));
  assert.equal(by['auto:v1:gomme'].title, 'Cambio gomme invernali scade tra 11 giorni');
  assert.equal(by['auto:v1:gomme'].status, 'warning');
  assert.equal(by['auto:v1:m:olio'].status, 'critical'); // 14.500 km su 15.000 = 0,967
  assert.equal(by['auto:v1:m:olio'].title, 'Cambio olio tra 500 km');
  assert.equal(by['auto:v1:m:terg'].status, 'unknown');
  assert.equal(by['auto:v1:m:terg'].title, 'Tergicristalli: da fare, senza data');
  assert.equal(by['auto:v1:m:batt'], undefined);
  assert.equal(Object.keys(by).some((k) => k.includes('altra')), false);
});

test('Manutenzioni di casa una tantum: fatte escluse, senza data da completare', () => {
  const issues = maintenanceIssues({ homeMaintenance: [
    { id: 'm1', title: 'Imbiancare', dueDate: addDays(today, -3) },
    { id: 'm2', title: 'Tenda' },
    { id: 'm3', title: 'Lavandino', dueDate: addDays(today, -3), doneAt: addDays(today, -4) },
  ] }, today);
  assert.deepEqual(issues.map((i) => [i.title, i.status]), [['Imbiancare in ritardo di 3 giorni', 'overdue'], ['Tenda: da fare, senza data', 'unknown']]);
});
