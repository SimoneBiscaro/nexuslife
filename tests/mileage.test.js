import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateDateForKm, estimateKmPerDay, latestKm } from '../app/src/domain/mileage.js';
import { addDays } from '../app/src/domain/dates.js';

const today = '2026-11-03';
const ago = (d) => addDays(today, -d);

test('regressione lineare su letture regolari', () => {
  const r = estimateKmPerDay([
    { date: ago(60), km: 10000 }, { date: ago(30), km: 11200 }, { date: ago(0), km: 12400 },
  ], today);
  assert.equal(r.generic, false);
  assert.ok(Math.abs(r.kmPerDay - 40) < 1e-9);
  assert.equal(r.samples, 3);
});

test('letture insufficienti → 33 km/giorno "stima generica"', () => {
  const generic = { kmPerDay: 33, generic: true, label: 'stima generica' };
  const pick = (r) => ({ kmPerDay: r.kmPerDay, generic: r.generic, label: r.label });
  assert.deepEqual(pick(estimateKmPerDay([], today)), generic);
  assert.deepEqual(pick(estimateKmPerDay([{ date: ago(20), km: 1000 }], today)), generic);
  // due letture distanti meno di 14 giorni
  assert.deepEqual(pick(estimateKmPerDay([{ date: ago(13), km: 1000 }, { date: ago(0), km: 1500 }], today)), generic);
  // letture più vecchie di 180 giorni ignorate
  assert.deepEqual(pick(estimateKmPerDay([{ date: ago(200), km: 1000 }, { date: ago(10), km: 9000 }], today)), generic);
});

test('due letture distanti esattamente 14 giorni bastano', () => {
  const r = estimateKmPerDay([{ date: ago(14), km: 1000 }, { date: ago(0), km: 1700 }], today);
  assert.equal(r.generic, false);
  assert.equal(r.kmPerDay, 50);
});

test('pendenza limitata a [0, 500]', () => {
  assert.equal(estimateKmPerDay([{ date: ago(20), km: 0 }, { date: ago(0), km: 20000 }], today).kmPerDay, 500);
  assert.equal(estimateKmPerDay([{ date: ago(20), km: 5000 }, { date: ago(0), km: 4000 }], today).kmPerDay, 0);
});

test('letture eliminate o future ignorate', () => {
  const r = estimateKmPerDay([
    { date: ago(30), km: 1000 }, { date: ago(0), km: 1300 },
    { date: ago(15), km: 99999, deleted: true }, { date: addDays(today, 5), km: 99999 },
  ], today);
  assert.equal(r.kmPerDay, 10);
});

test('km attuali e data stimata', () => {
  assert.equal(latestKm({ currentKm: 12000 }, [{ km: 12500 }, { km: 99999, deleted: true }]), 12500);
  assert.equal(estimateDateForKm(13000, 12000, 50, today), '2026-11-23');
  assert.equal(estimateDateForKm(13000, 12010, 50, today), '2026-11-23'); // 19,8 → 20 giorni
  assert.equal(estimateDateForKm(12000, 12500, 50, today), today);
  assert.equal(estimateDateForKm(13000, 12000, 0, today), null);
});
