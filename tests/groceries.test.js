import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  concludeShopping, DEFAULT_CATEGORIES, findOpenItem, itemsToAutoArchive, KEYWORD_COUNT, keywordCategory,
  normalizeName, parseQuickAdd, reassignDeletedCategory, sortOpenItems, suggestCategory, urgencyGlow,
} from '../app/src/domain/groceries.js';

const categories = DEFAULT_CATEGORIES.map((c) => ({ ...c, id: `cat-${c.normName}` }));
const cat = (n) => `cat-${n}`;

test('normalizzazione nomi', () => {
  assert.equal(normalizeName('  Caffè   Macinato '), 'caffe macinato');
  assert.equal(normalizeName('PERÒ'), 'pero');
  assert.equal(normalizeName('Uova'), 'uova'); // plurale non toccato
  assert.equal(normalizeName('Pomodori'), 'pomodori');
  assert.equal(normalizeName(null), '');
});

test('aggiunta rapida: "latte x2!"', () => {
  assert.deepEqual(parseQuickAdd('latte x2!'), { name: 'latte', normName: 'latte', quantity: 2, urgency: 'urgente' });
});

test('aggiunta rapida: "acqua*" → scorta', () => {
  assert.deepEqual(parseQuickAdd('acqua*'), { name: 'acqua', normName: 'acqua', quantity: 1, urgency: 'scorta' });
});

test('aggiunta rapida: "3x uova" e varianti', () => {
  assert.deepEqual(parseQuickAdd('3x uova'), { name: 'uova', normName: 'uova', quantity: 3, urgency: 'normale' });
  assert.equal(parseQuickAdd('Uova X6').quantity, 6);
  assert.equal(parseQuickAdd('carta igienica x 4').name, 'carta igienica x 4'); // "x 4" staccato non è quantità
  assert.deepEqual(parseQuickAdd('  Caffè  macinato  x2  ! '), { name: 'Caffè macinato', normName: 'caffe macinato', quantity: 2, urgency: 'urgente' });
  assert.equal(parseQuickAdd('pane').urgency, 'normale');
  assert.equal(parseQuickAdd('7up').name, '7up');
  assert.equal(parseQuickAdd('x2!'), null);
  assert.equal(parseQuickAdd('   '), null);
});

test('dizionario con almeno 80 parole chiave', () => {
  assert.ok(KEYWORD_COUNT >= 80, `solo ${KEYWORD_COUNT} parole chiave`);
});

test('categoria dal dizionario italiano', () => {
  assert.equal(keywordCategory('latte'), 'freschi');
  assert.equal(keywordCategory('acqua'), 'bevande');
  assert.equal(keywordCategory('detersivo'), 'cura casa');
  assert.equal(keywordCategory('detersivo piatti'), 'cura casa');
  assert.equal(keywordCategory('pasta'), 'dispensa');
  assert.equal(keywordCategory('pomodori pelati'), 'dispensa');
  assert.equal(keywordCategory('pomodori'), 'freschi');
  assert.equal(keywordCategory('latte di mandorla'), 'bevande');
  assert.equal(keywordCategory('caffè'), 'dispensa');
  assert.equal(keywordCategory('mele golden'), 'freschi');
  assert.equal(keywordCategory('pile aa'), 'altro');
  assert.equal(keywordCategory('quinoa'), null);
});

test('categoria proposta: ultima usata → dizionario → Dispensa', () => {
  const history = [
    { normName: 'latte', categoryId: cat('dispensa'), date: '2026-10-01' },
    { normName: 'latte', categoryId: cat('bevande'), date: '2026-10-20' },
  ];
  assert.equal(suggestCategory('latte', { categories, history }), cat('bevande'));
  assert.equal(suggestCategory('latte', { categories }), cat('freschi'));
  assert.equal(suggestCategory('quinoa', { categories }), cat('dispensa'));
  // l'ultima categoria usata è stata eliminata → si passa al dizionario
  const deleted = categories.map((c) => (c.id === cat('bevande') ? { ...c, deleted: true } : c));
  assert.equal(suggestCategory('latte', { categories: deleted, history }), cat('dispensa'));
});

test('bagliore: urgente ambra, urgente da più di 2 giorni rosso', () => {
  const now = '2026-11-03T12:00:00Z';
  assert.equal(urgencyGlow({ urgency: 'normale', addedAt: '2026-10-01T00:00:00Z' }, now), null);
  assert.equal(urgencyGlow({ urgency: 'urgente', addedAt: '2026-11-02T12:00:00Z' }, now), 'warning');
  assert.equal(urgencyGlow({ urgency: 'urgente', addedAt: '2026-11-01T12:00:00Z' }, now), 'warning'); // esattamente 48 h
  assert.equal(urgencyGlow({ urgency: 'urgente', addedAt: '2026-11-01T11:59:00Z' }, now), 'critical');
});

test('concludi spesa: acquisti dagli spuntati e archiviazione', () => {
  const items = [
    { id: 'a', name: 'Latte', normName: 'latte', categoryId: cat('freschi'), checkedAt: '2026-11-03T10:00:00Z' },
    { id: 'b', name: 'Pane', normName: 'pane', categoryId: cat('freschi') },
    { id: 'c', name: 'Vino', normName: 'vino', categoryId: cat('bevande'), checkedAt: '2026-11-03T10:00:00Z', archived: true },
  ];
  const r = concludeShopping(items, '2026-11-03T23:30:00Z'); // già 4/11 a Roma
  assert.deepEqual(r.purchases, [{ normName: 'latte', name: 'Latte', date: '2026-11-04', categoryId: cat('freschi') }]);
  assert.deepEqual(r.archive, [{ id: 'a', archived: true }]);
});

test('archiviazione automatica degli spuntati da più di 6 ore', () => {
  const now = '2026-11-03T18:00:00Z';
  const items = [
    { id: 'a', checkedAt: '2026-11-03T11:59:00Z' },
    { id: 'b', checkedAt: '2026-11-03T12:00:00Z' },
    { id: 'c' },
    { id: 'd', checkedAt: '2026-11-01T00:00:00Z', archived: true },
  ];
  assert.deepEqual(itemsToAutoArchive(items, now).map((i) => i.id), ['a']);
});

test('categoria eliminata → articoli in Altro', () => {
  const records = [
    { entity: 'groceryItem', id: '1', categoryId: 'x' },
    { entity: 'groceryItem', id: '2', categoryId: 'y' },
    { entity: 'groceryPurchase', id: '3', categoryId: 'x' },
    { entity: 'groceryItem', id: '4', categoryId: 'x', deleted: true },
  ];
  assert.deepEqual(reassignDeletedCategory(records, 'x', cat('altro')), [
    { id: '1', entity: 'groceryItem', categoryId: cat('altro') },
    { id: '3', entity: 'groceryPurchase', categoryId: cat('altro') },
  ]);
});

test('lista aperta: ordine e ricerca per nome', () => {
  const items = [
    { id: 'a', normName: 'pane', urgency: 'normale', addedAt: '2026-11-01T00:00:00Z' },
    { id: 'b', normName: 'latte', urgency: 'urgente', addedAt: '2026-11-02T00:00:00Z' },
    { id: 'c', normName: 'acqua', urgency: 'scorta', addedAt: '2026-11-01T00:00:00Z' },
    { id: 'd', normName: 'uova', urgency: 'urgente', addedAt: '2026-11-01T00:00:00Z', checkedAt: '2026-11-03T00:00:00Z' },
    { id: 'e', normName: 'vino', urgency: 'normale', addedAt: '2026-11-01T00:00:00Z', archived: true },
  ];
  assert.deepEqual(sortOpenItems(items).map((i) => i.id), ['b', 'a', 'c', 'd']);
  assert.equal(findOpenItem(items, 'latte').id, 'b');
  assert.equal(findOpenItem(items, 'vino'), null);
});
