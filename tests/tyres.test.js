import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tyreChange, tyreChangePatch, TYRE_WINDOWS } from '../app/src/domain/tyres.js';

const pick = (c) => c && `${c.target}:${c.due}:${c.status}:${c.inWindow}`;

test('finestre nazionali del cambio gomme', () => {
  assert.deepEqual(TYRE_WINDOWS, { invernali: { from: '10-15', due: '11-15' }, estive: { from: '04-15', due: '05-15' } });
});

test('nessun cambio senza tipo o con le quattro stagioni', () => {
  assert.equal(tyreChange({}, '2026-11-04'), null);
  assert.equal(tyreChange({ tyreType: 'quattroStagioni' }, '2026-11-04'), null);
  assert.equal(tyreChangePatch({ tyreType: 'quattroStagioni' }, '2026-11-04'), null);
});

test('estive montate: invernali entro il 15 novembre', () => {
  assert.equal(pick(tyreChange({ tyreType: 'estive' }, '2026-06-01')), 'invernali:2026-11-15:ok:false');
  assert.equal(pick(tyreChange({ tyreType: 'estive' }, '2026-10-20')), 'invernali:2026-11-15:warning:true');
  assert.equal(pick(tyreChange({ tyreType: 'estive' }, '2026-11-10')), 'invernali:2026-11-15:critical:true');
  assert.equal(pick(tyreChange({ tyreType: 'estive' }, '2026-11-15')), 'invernali:2026-11-15:critical:true');
  assert.equal(pick(tyreChange({ tyreType: 'estive' }, '2026-11-16')), 'invernali:2026-11-15:overdue:false');
  // in pieno inverno con le estive: in ritardo dal 15 novembre dell'anno prima
  const jan = tyreChange({ tyreType: 'estive' }, '2027-01-10');
  assert.equal(pick(jan), 'invernali:2026-11-15:overdue:false');
  assert.equal(jan.days, -56);
  // dal 15 aprile le estive sono di nuovo regolari: prossimo cambio a novembre
  assert.equal(pick(tyreChange({ tyreType: 'estive' }, '2027-04-15')), 'invernali:2027-11-15:ok:false');
  assert.equal(pick(tyreChange({ tyreType: 'estive' }, '2027-04-14')), 'invernali:2026-11-15:overdue:false');
});

test('invernali montate: estive entro il 15 maggio', () => {
  assert.equal(pick(tyreChange({ tyreType: 'invernali' }, '2026-11-20')), 'estive:2027-05-15:ok:false');
  assert.equal(pick(tyreChange({ tyreType: 'invernali' }, '2026-10-15')), 'estive:2027-05-15:ok:false');
  assert.equal(pick(tyreChange({ tyreType: 'invernali' }, '2027-04-20')), 'estive:2027-05-15:warning:true');
  assert.equal(pick(tyreChange({ tyreType: 'invernali' }, '2027-05-10')), 'estive:2027-05-15:critical:true');
  assert.equal(pick(tyreChange({ tyreType: 'invernali' }, '2027-07-01')), 'estive:2027-05-15:overdue:false');
  assert.equal(pick(tyreChange({ tyreType: 'invernali' }, '2027-10-14')), 'estive:2027-05-15:overdue:false');
});

test('cambio fatto: il tipo montato si inverte', () => {
  assert.deepEqual(tyreChangePatch({ tyreType: 'estive' }, '2026-11-04'), { tyreType: 'invernali', tyreChangedAt: '2026-11-04' });
  assert.deepEqual(tyreChangePatch({ tyreType: 'invernali' }, '2027-04-20'), { tyreType: 'estive', tyreChangedAt: '2027-04-20' });
  assert.equal(pick(tyreChange({ tyreType: 'invernali' }, '2026-11-04')), 'estive:2027-05-15:ok:false');
});
