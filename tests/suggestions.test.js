import { test } from 'node:test';
import assert from 'node:assert/strict';
import { purchaseRhythm, snoozeUntil, suggestGroceries } from '../app/src/domain/suggestions.js';
import { addDays } from '../app/src/domain/dates.js';

const today = '2026-11-03';
const ago = (d) => addDays(today, -d);
const buys = (normName, daysAgo) => daysAgo.map((d) => ({ normName, name: normName, date: ago(d), categoryId: 'c' }));

test('latte ogni 7 giorni, ultimo 6 giorni fa → maturità 0,857 → suggerito', () => {
  const purchases = buys('latte', [20, 13, 6]);
  const [s] = suggestGroceries({ purchases, today });
  assert.equal(s.normName, 'latte');
  assert.equal(s.cycle, 7);
  assert.equal(s.maturity.toFixed(3), '0.857');
  assert.equal(s.confidence, 'alta');
});

test('latte ultimo 5 giorni fa → maturità 0,714 → non suggerito', () => {
  assert.deepEqual(suggestGroceries({ purchases: buys('latte', [19, 12, 5]), today }), []);
});

test('acquisti nello stesso giorno contano una volta', () => {
  // 3 righe ma 2 giorni distinti: non bastano
  assert.deepEqual(suggestGroceries({ purchases: buys('pane', [14, 7, 7]), today }), []);
  const r = purchaseRhythm([ago(21), ago(14), ago(14), ago(7)], today);
  assert.equal(r.purchases, 3);
  assert.equal(r.cycle, 7);
});

test('servono almeno 3 acquisti negli ultimi 180 giorni', () => {
  assert.deepEqual(suggestGroceries({ purchases: buys('olio', [400, 200, 30]), today }), []);
  assert.equal(purchaseRhythm([ago(200), ago(100), ago(30)], today), null);
});

test('esclusi: già in lista, silenziati, posticipati', () => {
  const purchases = buys('latte', [20, 13, 6]);
  assert.deepEqual(suggestGroceries({ purchases, today, openItems: [{ normName: 'latte' }] }), []);
  // un articolo archiviato non conta come "in lista"
  assert.equal(suggestGroceries({ purchases, today, openItems: [{ normName: 'latte', archived: true }] }).length, 1);
  assert.deepEqual(suggestGroceries({ purchases, today, feedback: [{ normName: 'latte', muted: true }] }), []);
  assert.deepEqual(suggestGroceries({ purchases, today, feedback: [{ normName: 'latte', snoozeUntil: addDays(today, 1) }] }), []);
  assert.equal(suggestGroceries({ purchases, today, feedback: [{ normName: 'latte', snoozeUntil: today }] }).length, 1);
});

test('snooze di 3 giorni', () => {
  assert.equal(snoozeUntil('2026-02-27'), '2026-03-02');
});

test('confidenza bassa solo con maturità ≥ 1,0', () => {
  // intervalli 2, 10, 2, 10 → mediana 6, variabilità alta
  const irregular = buys('birra', [29, 27, 17, 15, 5]);
  const r = purchaseRhythm(irregular.map((p) => p.date), today);
  assert.equal(r.confidence, 'bassa');
  assert.ok(r.maturity < 1);
  assert.deepEqual(suggestGroceries({ purchases: irregular, today }), []);
  const late = buys('birra', [31, 29, 19, 17, 7]); // maturità 7/6 ≥ 1
  assert.equal(suggestGroceries({ purchases: late, today })[0].confidence, 'bassa');
});

test('confidenza media', () => {
  // intervalli 5, 10, 5, 10 → media 7,5, devstd 2,5 → variabilità 0,33
  const r = purchaseRhythm([ago(31), ago(26), ago(16), ago(11), ago(1)], today);
  assert.equal(r.confidence, 'media');
});

test('massimo 8 suggerimenti ordinati per maturità', () => {
  const purchases = [];
  for (let i = 0; i < 10; i++) purchases.push(...buys(`p${i}`, [20 + i, 13 + i, 6 + i]));
  const list = suggestGroceries({ purchases, today });
  assert.equal(list.length, 8);
  assert.deepEqual(list.map((s) => s.normName), ['p9', 'p8', 'p7', 'p6', 'p5', 'p4', 'p3', 'p2']);
  for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].maturity >= list[i].maturity);
});
