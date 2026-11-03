import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDueDate, formatEuro, formatKm, parseDecimal, parseKm } from '../app/src/ui/format.js';

const nbsp = (s) => s.replace(/ /g, ' ');

test('formati italiani', () => {
  assert.equal(nbsp(formatEuro(12345.5)), '12.345,50 €');
  assert.equal(nbsp(formatEuro(1234.5)), '1234,50 €'); // in it-IT il punto compare da 5 cifre
  assert.equal(formatKm(45000), '45.000 km');
});

test('importi scritti all\'italiana', () => {
  assert.equal(parseDecimal('1.234,50'), 1234.5);
  assert.equal(parseDecimal('12,5'), 12.5);
  assert.equal(parseDecimal('12.5'), 12.5);
  assert.equal(parseDecimal('15.000'), 15000);
  assert.equal(parseDecimal(' 89,90 € '), 89.9);
  assert.equal(parseDecimal(''), null);
  assert.equal(parseDecimal('abc'), null);
});

test('km con separatori', () => {
  assert.equal(parseKm('45.000'), 45000);
  assert.equal(parseKm('45 000'), 45000);
  assert.equal(parseKm('12,5'), null);
  assert.equal(parseKm(''), null);
});

test('data di scadenza con articolo e anno', () => {
  assert.equal(formatDueDate('2026-11-08', '2026-11-03'), 'l\'8 nov');
  assert.equal(formatDueDate('2026-11-11', '2026-11-03'), 'l\'11 nov');
  assert.equal(formatDueDate('2026-11-20', '2026-11-03'), 'il 20 nov');
  assert.equal(formatDueDate('2028-02-29', '2026-11-03'), 'il 29 feb 2028');
});
