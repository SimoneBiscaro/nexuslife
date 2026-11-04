import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openVisitPlans, visitPlanLabel, visitPlanState } from '../app/src/domain/health.js';
import { collectDeadlines } from '../app/src/domain/overview.js';
import { buildReminderEvents } from '../app/src/domain/reminders.js';
import { gardenState, healthIssues } from '../app/src/domain/garden.js';

const now = '2026-11-04T10:00:00Z';
const today = '2026-11-04';

test('singola da prenotare: stato della data "entro"', () => {
  const s = visitPlanState({ id: 'p1', type: 'oculista', dueBy: '2026-11-20' }, [], now);
  assert.equal(s.state, 'daPrenotare');
  assert.equal(s.status, 'warning');
  assert.equal(s.days, 16);
  assert.equal(visitPlanState({ id: 'p1', type: 'oculista' }, [], now).status, 'unknown');
});

test('prenotata con una visita futura collegata, fatta dopo la visita', () => {
  const plan = { id: 'p1', type: 'oculista', dueBy: '2026-11-20' };
  const booked = visitPlanState(plan, [{ id: 'v1', planId: 'p1', dateTime: '2026-11-18T09:00:00Z' }], now);
  assert.equal(booked.state, 'prenotata');
  assert.equal(booked.booked.id, 'v1');
  assert.equal(booked.status, 'ok');
  const done = visitPlanState(plan, [{ id: 'v1', planId: 'p1', dateTime: '2026-11-01T09:00:00Z' }], now);
  assert.equal(done.state, 'fatta');
  assert.equal(visitPlanState({ ...plan, doneAt: today }, [], now).state, 'fatta');
  // una visita eliminata non conta
  assert.equal(visitPlanState(plan, [{ id: 'v1', planId: 'p1', dateTime: '2026-11-18T09:00:00Z', deleted: true }], now).state, 'daPrenotare');
});

test('periodica: la prossima scadenza è l\'ultima visita + intervallo', () => {
  const plan = { id: 'd', type: 'dentista', intervalMonths: 6, dueBy: '2026-01-01' };
  const visits = [
    { id: 'a', planId: 'd', dateTime: '2026-02-10T09:00:00Z' },
    { id: 'b', planId: 'd', dateTime: '2026-05-12T09:00:00Z' },
    { id: 'x', planId: 'altro', dateTime: '2026-10-01T09:00:00Z' },
  ];
  const s = visitPlanState(plan, visits, now);
  assert.equal(s.state, 'daPrenotare');
  assert.equal(s.last.id, 'b');
  assert.equal(s.dueBy, '2026-11-12');
  assert.equal(s.status, 'warning'); // tra 8 giorni
  // senza visite collegate vale la data indicata
  assert.equal(visitPlanState(plan, [], now).dueBy, '2026-01-01');
  assert.equal(visitPlanState(plan, [], now).status, 'overdue');
  // prenotata la prossima: non va più prenotata, e dopo la visita riparte da lì
  const next = [...visits, { id: 'c', planId: 'd', dateTime: '2026-11-25T09:00:00Z' }];
  assert.equal(visitPlanState(plan, next, now).state, 'prenotata');
  assert.equal(visitPlanState(plan, next, '2026-12-01T10:00:00Z').dueBy, '2027-05-25');
});

test('elenco aperto: da prenotare per scadenza, poi prenotate; fatte ed eliminate escluse', () => {
  const plans = [
    { id: 'lontana', type: 'altro', dueBy: '2027-03-01' },
    { id: 'prenotata', type: 'oculista', dueBy: '2026-11-20' },
    { id: 'fatta', type: 'altro', doneAt: '2026-10-01' },
    { id: 'senza', type: 'altro' },
    { id: 'vicina', type: 'dentista', dueBy: '2026-11-10' },
    { id: 'eliminata', type: 'altro', dueBy: '2026-11-05', deleted: true },
  ];
  const visits = [{ id: 'v', planId: 'prenotata', dateTime: '2026-11-18T09:00:00Z' }];
  assert.deepEqual(openVisitPlans(plans, visits, now).map((x) => x.plan.id), ['vicina', 'lontana', 'senza', 'prenotata']);
});

test('etichetta', () => {
  assert.equal(visitPlanLabel({ type: 'dentista', doctor: 'Dott. Rossi', intervalMonths: 6 }), 'Dentista · Dott. Rossi · ogni 6 mesi');
  assert.equal(visitPlanLabel({ type: 'oculista' }), 'Oculista');
});

test('le visite da prenotare entrano in avvisi, calendario e giardino', () => {
  const data = { visitPlans: [{ id: 'p1', type: 'dentista', dueBy: '2026-11-10', updatedAt: now }], medicalVisits: [] };
  const item = collectDeadlines(data, today).find((i) => i.kind === 'prenotazione');
  assert.equal(item.title, 'Prenotare visita dentista');
  assert.equal(item.status, 'critical');
  assert.equal(item.section, 'salute');
  const ev = buildReminderEvents(data, { today }).find((e) => e.uid === 'visitPlan-p1');
  assert.equal(ev.date, '2026-11-10');
  assert.equal(ev.reminders.length, 2);
  const issues = healthIssues(data, today);
  assert.equal(issues[0].title, 'Visita dentista da prenotare entro 6 giorni');
  assert.equal(issues[0].maskedTitle, 'Visita da prenotare entro 6 giorni');
  assert.equal(gardenState(data, { today, now }).plants.find((p) => p.id === 'salute').stage.id, 'assetata');
});
