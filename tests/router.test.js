import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHash, SECTIONS } from '../app/src/router.js';

test('le 5 sezioni fisse sono nell\'ordine delle scorciatoie', () => {
  assert.deepEqual(SECTIONS.map((s) => `${s.key}:${s.id}`), ['1:oggi', '2:auto', '3:casa', '4:spesa', '5:salute']);
});

test('parseHash riconosce sezioni e sottopagine', () => {
  assert.deepEqual(parseHash('#/auto'), { path: '/auto', section: 'auto', sub: '' });
  assert.deepEqual(parseHash('#/impostazioni/design'), { path: '/impostazioni/design', section: 'impostazioni', sub: 'design' });
  assert.deepEqual(parseHash('#/spesa/'), { path: '/spesa', section: 'spesa', sub: '' });
});

test('parseHash rifiuta rotte sconosciute o vuote', () => {
  assert.equal(parseHash(''), null);
  assert.equal(parseHash('#/'), null);
  assert.equal(parseHash('#/inesistente'), null);
  assert.equal(parseHash('#/auto/xyz'), null);
});
