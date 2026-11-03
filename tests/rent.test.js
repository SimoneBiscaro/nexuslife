import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installmentDueDate, installmentShares, installmentsToCreate, paymentStatus } from '../app/src/domain/rent.js';

const contract = { id: 'c1', totalAmount: 900, personalShare: 450, dueDay: 31, startDate: '2026-09-01' };

test('scadenza rata: giorno oltre fine mese → ultimo giorno', () => {
  assert.equal(installmentDueDate(31, '2026-11'), '2026-11-30');
  assert.equal(installmentDueDate(31, '2026-02'), '2026-02-28');
  assert.equal(installmentDueDate(30, '2028-02'), '2028-02-29');
  assert.equal(installmentDueDate(29, '2027-02'), '2027-02-28');
  assert.equal(installmentDueDate(5, '2026-12'), '2026-12-05');
  assert.equal(installmentDueDate(31, '2026-12'), '2026-12-31');
});

test('genera rata del mese corrente e del successivo', () => {
  const list = installmentsToCreate(contract, [], '2026-11-03');
  assert.deepEqual(list, [
    { contractId: 'c1', periodKey: '2026-11', dueDate: '2026-11-30', amount: 900, paidAt: null },
    { contractId: 'c1', periodKey: '2026-12', dueDate: '2026-12-31', amount: 900, paidAt: null },
  ]);
});

test('non duplica rate esistenti e attraversa l\'anno', () => {
  const existing = [{ contractId: 'c1', periodKey: '2026-12' }, { contractId: 'altro', periodKey: '2027-01' }];
  const list = installmentsToCreate(contract, existing, '2026-12-15');
  assert.deepEqual(list.map((i) => i.periodKey), ['2027-01']);
  // una rata eliminata non conta come esistente
  const again = installmentsToCreate(contract, [{ contractId: 'c1', periodKey: '2026-11', deleted: true }], '2026-11-01');
  assert.deepEqual(again.map((i) => i.periodKey), ['2026-11', '2026-12']);
});

test('nessuna rata prima dell\'inizio del contratto', () => {
  const list = installmentsToCreate({ ...contract, startDate: '2026-12-01' }, [], '2026-11-03');
  assert.deepEqual(list.map((i) => i.periodKey), ['2026-12']);
});

test('stato: paid / overdue / pending', () => {
  assert.equal(paymentStatus({ dueDate: '2026-11-01', paidAt: '2026-10-30T10:00:00Z' }, '2026-11-03'), 'paid');
  assert.equal(paymentStatus({ dueDate: '2026-11-02' }, '2026-11-03'), 'overdue');
  assert.equal(paymentStatus({ dueDate: '2026-11-03' }, '2026-11-03'), 'pending');
  assert.equal(paymentStatus({ dueDate: '2026-11-10' }, '2026-11-03'), 'pending');
});

test('totale e quota personale', () => {
  assert.deepEqual(installmentShares({ amount: 900 }, contract), { total: 900, personal: 450, others: 450 });
  assert.deepEqual(installmentShares({ amount: 800.5 }, { personalShare: 400.25 }), { total: 800.5, personal: 400.25, others: 400.25 });
});
