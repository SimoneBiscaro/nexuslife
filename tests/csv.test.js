import { test } from 'node:test';
import assert from 'node:assert/strict';
import { columnsFor, escapeCell, formatCell, parseCsv, toCsv } from '../app/src/backup/csv.js';

test('formati italiani nelle celle', () => {
  assert.equal(formatCell(1234.5), '1234,5');
  assert.equal(formatCell(0), '0');
  assert.equal(formatCell('2026-11-03'), '03/11/2026');
  assert.equal(formatCell('2026-07-01T08:30:00.000Z'), '01/07/2026 10:30');
  assert.equal(formatCell(true), 'sì');
  assert.equal(formatCell(null), '');
  assert.equal(formatCell({ a: 1 }), '{"a":1}');
});

test('escape di ; " e a capo', () => {
  assert.equal(escapeCell('semplice'), 'semplice');
  assert.equal(escapeCell('a;b'), '"a;b"');
  assert.equal(escapeCell('dice "ciao"'), '"dice ""ciao"""');
  assert.equal(escapeCell('riga1\nriga2'), '"riga1\nriga2"');
});

test('CSV con BOM, ; e campi difficili: andata e ritorno', () => {
  const rows = [
    { name: 'Caffè, macinato', notes: 'prezzo; offerta', amount: 4.99, date: '2026-11-03' },
    { name: 'Però "speciale"', notes: 'prima riga\nseconda riga', amount: 12, date: '2026-01-31' },
  ];
  const text = toCsv(rows, [{ key: 'name', label: 'Nome' }, { key: 'notes' }, { key: 'amount' }, { key: 'date' }]);
  assert.ok(text.startsWith('﻿'));
  assert.ok(text.includes('\r\n'));
  assert.deepEqual(parseCsv(text), [
    ['Nome', 'notes', 'amount', 'date'],
    ['Caffè, macinato', 'prezzo; offerta', '4,99', '03/11/2026'],
    ['Però "speciale"', 'prima riga\nseconda riga', '12', '31/01/2026'],
  ]);
});

test('colonne: i campi utili prima, date di sistema in fondo, senza entity/deleted', () => {
  const cols = columnsFor([{ id: '1', entity: 'bill', deleted: false, updatedAt: 'x', createdAt: 'x', provider: 'Enel', amount: 1, kind: 'luce', dueDate: 'd' }]).map((c) => c.key);
  assert.deepEqual(cols, ['id', 'kind', 'dueDate', 'amount', 'provider', 'createdAt', 'updatedAt']);
});
