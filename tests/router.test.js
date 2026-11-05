import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXTRA_PAGES, parseHash, SECTIONS } from '../app/src/router.js';

test('le 5 sezioni fisse sono nell\'ordine delle scorciatoie', () => {
  assert.deepEqual(SECTIONS.map((s) => `${s.key}:${s.id}`), ['1:oggi', '2:auto', '3:casa', '4:spesa', '5:salute']);
});

test('parseHash riconosce sezioni e sottopagine', () => {
  assert.deepEqual(parseHash('#/auto'), { path: '/auto', section: 'auto', sub: '' });
  assert.deepEqual(parseHash('#/impostazioni/design'), { path: '/impostazioni/design', section: 'impostazioni', sub: 'design' });
  assert.deepEqual(parseHash('#/spesa/'), { path: '/spesa', section: 'spesa', sub: '' });
  assert.deepEqual(parseHash('#/giardino'), { path: '/giardino', section: 'giardino', sub: '' });
});

test('parseHash rifiuta rotte sconosciute o vuote', () => {
  assert.equal(parseHash(''), null);
  assert.equal(parseHash('#/'), null);
  assert.equal(parseHash('#/inesistente'), null);
  assert.equal(parseHash('#/auto/xyz'), null);
});

test('Giardino e To Do sono fuori dalla TabBar, con le scorciatoie G e T', () => {
  assert.equal(SECTIONS.some((s) => s.id === 'giardino'), false);
  assert.deepEqual(EXTRA_PAGES.map((p) => `${p.key}:${p.id}`), ['t:todo', 'g:giardino']);
  assert.deepEqual(parseHash('#/todo'), { path: '/todo', section: 'todo', sub: '' });
  assert.equal(SECTIONS.some((s) => s.key === 'g'), false);
});
