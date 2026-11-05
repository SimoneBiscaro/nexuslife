import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addRepeat, expiredTodos, isRepeating, markTodoDone, parseTodoInput, repeatLabel, sortTodos, todoState,
} from '../app/src/domain/todos.js';
import { collectDeadlines } from '../app/src/domain/overview.js';
import { buildReminderEvents } from '../app/src/domain/reminders.js';
import { gardenState, todoIssues } from '../app/src/domain/garden.js';

const today = '2026-11-05'; // giovedì
const now = '2026-11-05T10:00:00Z';

test('stato: stati delle scadenze, senza data sconosciuto, fatta chiusa', () => {
  assert.deepEqual(todoState({ title: 'Barbiere', dueDate: '2026-11-04' }, today), { done: false, repeating: false, status: 'overdue', days: -1 });
  assert.equal(todoState({ title: 'Barbiere', dueDate: '2026-11-10' }, today).status, 'critical');
  assert.equal(todoState({ title: 'Barbiere', dueDate: '2026-11-20' }, today).status, 'warning');
  assert.equal(todoState({ title: 'Barbiere', dueDate: '2027-01-20' }, today).status, 'ok');
  assert.equal(todoState({ title: 'Barbiere' }, today).status, 'unknown');
  assert.deepEqual(todoState({ title: 'Barbiere', dueDate: '2026-11-04', doneAt: today }, today), { done: true, repeating: false, status: 'ok', days: null });
});

test('ripetizione: giorni, settimane, mesi e etichetta', () => {
  assert.equal(isRepeating({ repeatEvery: 5, repeatUnit: 'settimane' }), true);
  assert.equal(isRepeating({ repeatEvery: 0, repeatUnit: 'settimane' }), false);
  assert.equal(isRepeating({ repeatEvery: 2, repeatUnit: 'anni' }), false);
  assert.equal(addRepeat('2026-11-05', 3, 'giorni'), '2026-11-08');
  assert.equal(addRepeat('2026-11-05', 5, 'settimane'), '2026-12-10');
  assert.equal(addRepeat('2026-01-31', 1, 'mesi'), '2026-02-28');
  assert.equal(repeatLabel({ repeatEvery: 5, repeatUnit: 'settimane' }), 'ogni 5 settimane');
  assert.equal(repeatLabel({ repeatEvery: 1, repeatUnit: 'mesi' }), 'ogni mese');
  assert.equal(repeatLabel({}), '');
});

test('"Fatto": una voce ripetuta si sposta dalla data di oggi, le altre si chiudono', () => {
  assert.deepEqual(markTodoDone({ title: 'Barbiere', dueDate: '2026-10-30', repeatEvery: 5, repeatUnit: 'settimane' }, today),
    { dueDate: '2026-12-10', lastDoneAt: today });
  assert.deepEqual(markTodoDone({ title: 'Barbiere', repeatEvery: 1, repeatUnit: 'mesi' }, today), { dueDate: '2026-12-05', lastDoneAt: today });
  assert.deepEqual(markTodoDone({ title: 'Multa', dueDate: '2026-11-10' }, today), { doneAt: today });
  // una ripetuta con doneAt (dati vecchi) resta aperta
  assert.equal(todoState({ title: 'X', dueDate: '2026-12-10', repeatEvery: 1, repeatUnit: 'mesi', doneAt: today }, today).done, false);
});

test('ordine: scadute e per data, poi senza data; fatte dalla più recente', () => {
  const { open, done } = sortTodos([
    { id: 'senza', title: 'A', createdAt: '2026-11-01' },
    { id: 'tardi', title: 'B', dueDate: '2026-11-01' },
    { id: 'presto', title: 'C', dueDate: '2026-11-07' },
    { id: 'fatta1', title: 'D', doneAt: '2026-11-01' },
    { id: 'fatta2', title: 'E', doneAt: '2026-11-04' },
    { id: 'via', title: 'F', dueDate: '2026-11-01', deleted: true },
  ], today);
  assert.deepEqual(open.map((x) => x.todo.id), ['tardi', 'presto', 'senza']);
  assert.deepEqual(done.map((x) => x.todo.id), ['fatta2', 'fatta1']);
});

test('fatte da più di 30 giorni: da eliminare (mai le ripetute)', () => {
  const ids = expiredTodos([
    { id: 'vecchia', doneAt: '2026-10-05' },
    { id: 'recente', doneAt: '2026-10-06' },
    { id: 'aperta', dueDate: '2026-01-01' },
    { id: 'ripetuta', doneAt: '2026-01-01', repeatEvery: 1, repeatUnit: 'mesi' },
  ], today).map((t) => t.id);
  assert.deepEqual(ids, ['vecchia']);
});

test('aggiunta rapida: la data in fondo al testo', () => {
  const p = (s) => parseTodoInput(s, today);
  assert.deepEqual(p('Chiamare barbiere domani'), { title: 'Chiamare barbiere', dueDate: '2026-11-06' });
  assert.deepEqual(p('Pagare multa oggi'), { title: 'Pagare multa', dueDate: today });
  assert.deepEqual(p('Ritirare pacco dopodomani'), { title: 'Ritirare pacco', dueDate: '2026-11-07' });
  assert.deepEqual(p('Pagare multa entro venerdì'), { title: 'Pagare multa', dueDate: '2026-11-06' });
  assert.deepEqual(p('Palestra giovedì'), { title: 'Palestra', dueDate: '2026-11-12' }); // oggi è giovedì: il prossimo
  assert.deepEqual(p('Rinnovare passaporto tra 3 mesi'), { title: 'Rinnovare passaporto', dueDate: '2027-02-05' });
  assert.deepEqual(p('Dentifricio fra 1 settimana'), { title: 'Dentifricio', dueDate: '2026-11-12' });
  assert.deepEqual(p('Regalo mamma il 12/11'), { title: 'Regalo mamma', dueDate: '2026-11-12' });
  assert.deepEqual(p('Auguri 3/1'), { title: 'Auguri', dueDate: '2027-01-03' }); // già passato quest'anno
  assert.deepEqual(p('Disdetta 1/2/2028'), { title: 'Disdetta', dueDate: '2028-02-01' });
  assert.deepEqual(p('Comprare 2/3 di farina'), { title: 'Comprare 2/3 di farina', dueDate: null });
  assert.deepEqual(p('Bolletta 31/2'), { title: 'Bolletta 31/2', dueDate: null });
  assert.deepEqual(p('domani'), { title: 'domani', dueDate: null });
  assert.deepEqual(p('  Chiamare   Luca  '), { title: 'Chiamare Luca', dueDate: null });
});

test('i To Do entrano in avvisi, calendario e giardino', () => {
  const data = { todos: [
    { id: 't1', title: 'Barbiere', dueDate: '2026-11-03', updatedAt: now },
    { id: 't2', title: 'Senza data', updatedAt: now },
    { id: 't3', title: 'Fatta', dueDate: '2026-11-03', doneAt: today, updatedAt: now },
  ] };
  const items = collectDeadlines(data, today).filter((i) => i.kind === 'todo');
  assert.deepEqual(items.map((i) => [i.title, i.status, i.href]), [['Barbiere', 'overdue', '#/todo']]);
  const events = buildReminderEvents({ todos: [{ id: 'f', title: 'Futuro', dueDate: '2026-11-20' }] }, { today });
  assert.equal(events[0].uid, 'todo-f');
  assert.equal(events[0].reminders.length, 2);
  const issues = todoIssues(data, today);
  assert.deepEqual(issues.map((i) => [i.title, i.status]), [['Barbiere: in ritardo di 2 giorni', 'overdue'], ['Senza data: senza data', 'unknown']]);
  const plant = gardenState(data, { today, now }).plants.find((p) => p.id === 'todo');
  assert.equal(plant.stage.id, 'appassita');
  assert.equal(plant.href, '#/todo');
  assert.equal(gardenState({}, { today, now }).plants.find((p) => p.id === 'todo').stage.id, 'germoglio');
});
