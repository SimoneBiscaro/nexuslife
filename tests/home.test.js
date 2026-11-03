import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activeContract, billTotals, currentInstallment, homePurchasesTotal, installmentUpdatesForContract,
  maintenanceState, paymentBadge, rentHistory, sortBills, sortHomePurchases, sortMaintenance,
} from '../app/src/domain/home.js';

const today = '2026-11-03';

test('contratto attivo e rate', () => {
  const contracts = [
    { id: 'old', createdAt: '2025-01-01T00:00:00Z' },
    { id: 'new', createdAt: '2026-01-01T00:00:00Z' },
    { id: 'gone', createdAt: '2026-06-01T00:00:00Z', deleted: true },
  ];
  assert.equal(activeContract(contracts).id, 'new');
  assert.equal(activeContract([]), null);
  const inst = [
    { id: 'a', contractId: 'new', periodKey: '2026-10' },
    { id: 'b', contractId: 'new', periodKey: '2026-11' },
    { id: 'c', contractId: 'new', periodKey: '2026-12' },
    { id: 'd', contractId: 'old', periodKey: '2026-11' },
  ];
  assert.deepEqual(rentHistory(inst, 'new').map((i) => i.id), ['c', 'b', 'a']);
  assert.equal(currentInstallment(inst, 'new', today).id, 'b');
});

test('modifica contratto: aggiornate solo le rate non pagate da questo mese', () => {
  const contract = { id: 'c', totalAmount: 950, dueDay: 31 };
  const inst = [
    { id: 'past', contractId: 'c', periodKey: '2026-10', amount: 900, dueDate: '2026-10-05' },
    { id: 'paid', contractId: 'c', periodKey: '2026-11', amount: 900, dueDate: '2026-11-05', paidAt: '2026-11-01' },
    { id: 'next', contractId: 'c', periodKey: '2026-12', amount: 900, dueDate: '2026-12-05' },
    { id: 'same', contractId: 'c', periodKey: '2027-02', amount: 950, dueDate: '2027-02-28' },
  ];
  assert.deepEqual(installmentUpdatesForContract(contract, inst, today), [{ id: 'next', amount: 950, dueDate: '2026-12-31' }]);
});

test('stato di pagamento in etichetta', () => {
  assert.deepEqual(paymentBadge({ dueDate: '2026-11-01', paidAt: '2026-11-01' }, today), { status: 'ok', label: 'Pagato' });
  assert.deepEqual(paymentBadge({ dueDate: '2026-11-02' }, today), { status: 'overdue', label: 'In ritardo' });
  assert.deepEqual(paymentBadge({ dueDate: '2026-11-06' }, today), { status: 'warning', label: 'In attesa' });
  assert.deepEqual(paymentBadge({ dueDate: '2026-11-20' }, today), { status: 'unknown', label: 'In attesa' });
});

test('totali bollette per mese e per tipo', () => {
  const bills = [
    { kind: 'luce', dueDate: '2026-01-15', amount: 80.4, paidAt: '2026-01-10' },
    { kind: 'luce', dueDate: '2026-03-15', amount: 70.1 },
    { kind: 'gas', dueDate: '2026-01-20', amount: 120 },
    { kind: 'internet', dueDate: '2025-12-20', amount: 30 },
    { kind: 'strano', dueDate: '2026-12-01', amount: 5 },
    { kind: 'acqua', dueDate: '2026-02-01', amount: 99, deleted: true },
  ];
  const t = billTotals(bills, 2026);
  assert.equal(t.months[0], 200.4);
  assert.equal(t.months[2], 70.1);
  assert.equal(t.months[11], 5);
  assert.equal(t.byKind.luce, 150.5);
  assert.equal(t.byKind.gas, 120);
  assert.equal(t.byKind.internet, 0);
  assert.equal(t.byKind.altro, 5);
  assert.equal(t.total, 275.5);
  assert.equal(t.unpaid, 195.1);
  assert.deepEqual(t.matrix.luce.slice(0, 3), [80.4, 0, 70.1]);
  assert.equal(t.matrix.gas[0], 120);
});

test('bollette: non pagate per scadenza, poi pagate dalla più recente', () => {
  const bills = [
    { id: 'p1', dueDate: '2026-09-01', paidAt: '2026-09-01' },
    { id: 'u2', dueDate: '2026-12-01' },
    { id: 'p2', dueDate: '2026-10-01', paidAt: '2026-10-01' },
    { id: 'u1', dueDate: '2026-11-10' },
  ];
  assert.deepEqual(sortBills(bills).map((b) => b.id), ['u1', 'u2', 'p2', 'p1']);
});

test('manutenzioni: stato calcolato e ordine per urgenza', () => {
  assert.deepEqual(maintenanceState({ intervalMonths: 12, lastDoneDate: '2025-11-10' }, today), { nextDate: '2026-11-10', status: 'critical', days: 7 });
  assert.deepEqual(maintenanceState({ intervalMonths: 6 }, today), { nextDate: null, status: 'unknown', days: null });
  const list = sortMaintenance([
    { id: 'a', intervalMonths: 12, lastDoneDate: '2026-06-01' },
    { id: 'b', intervalMonths: 6 },
    { id: 'c', intervalMonths: 3, lastDoneDate: '2026-07-01' },
  ], today);
  assert.deepEqual(list.map((x) => `${x.item.id}:${x.status}`), ['c:overdue', 'a:ok', 'b:unknown']);
});

test('da comprare per la casa: ordine e totale stimato', () => {
  const items = [
    { id: '1', name: 'Mensola', priority: 'bassa', estimatedPrice: 25 },
    { id: '2', name: 'Tenda', priority: 'alta', estimatedPrice: 40.5 },
    { id: '3', name: 'Viti', priority: 'alta', done: true, estimatedPrice: 5 },
    { id: '4', name: 'Lampada', priority: 'media' },
  ];
  assert.deepEqual(sortHomePurchases(items).map((i) => i.id), ['2', '4', '1', '3']);
  assert.equal(homePurchasesTotal(items), 65.5);
});
