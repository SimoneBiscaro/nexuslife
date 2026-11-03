import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRepo, TOMBSTONE_TTL_DAYS } from '../app/src/store/repo.js';
import { seedDefaults, startupMaintenance, SETTINGS_ID } from '../app/src/store/seed.js';
import { entityVersion } from '../app/src/store/state.js';
import { createMemoryAdapter } from './helpers/memory-db.js';

function setup(start = '2026-11-03T10:00:00.000Z') {
  let t = Date.parse(start);
  let n = 0;
  const adapter = createMemoryAdapter();
  const clock = { set: (iso) => { t = Date.parse(iso); }, advance: (ms) => { t += ms; } };
  const repo = createRepo(adapter, { clock: () => new Date(t), uuid: () => `id-${++n}` });
  return { repo, adapter, clock };
}

test('create imposta id, date e deleted, e accoda in outbox', async () => {
  const { repo, adapter } = setup();
  const v = await repo.create('vehicle', { name: 'T-Cross', plate: 'AA111AA' });
  assert.equal(v.id, 'id-1');
  assert.equal(v.entity, 'vehicle');
  assert.equal(v.createdAt, '2026-11-03T10:00:00.000Z');
  assert.equal(v.updatedAt, v.createdAt);
  assert.equal(v.deleted, false);
  assert.deepEqual(await repo.get('vehicle', 'id-1'), v);
  assert.deepEqual(await adapter.outboxList(), [{ key: 'vehicle:id-1', entity: 'vehicle', id: 'id-1', updatedAt: v.updatedAt }]);
});

test('update aggiorna updatedAt in modo crescente e protegge i campi di sistema', async () => {
  const { repo } = setup();
  const v = await repo.create('vehicle', { name: 'A' });
  const u1 = await repo.update('vehicle', v.id, { name: 'B', id: 'altro', createdAt: 'x', updatedAt: '1999-01-01T00:00:00Z' });
  assert.equal(u1.name, 'B');
  assert.equal(u1.id, v.id);
  assert.equal(u1.createdAt, v.createdAt);
  assert.ok(u1.updatedAt > v.updatedAt, 'updatedAt deve crescere anche a orologio fermo');
  const u2 = await repo.update('vehicle', v.id, { name: 'C' });
  assert.ok(u2.updatedAt > u1.updatedAt);
  await assert.rejects(repo.update('vehicle', 'nessuno', {}));
});

test('updatedAt supera sempre quello esistente, anche se arriva da un orologio avanti', async () => {
  const { repo, adapter } = setup();
  await adapter.commit([{ entity: 'bill', id: 'b', createdAt: '2026-11-03T10:00:00.000Z', updatedAt: '2026-12-01T00:00:00.000Z', deleted: false }]);
  const u = await repo.update('bill', 'b', { amount: 10 });
  assert.equal(u.updatedAt, '2026-12-01T00:00:00.001Z');
});

test('softDelete crea una tombstone, esclusa da get e list', async () => {
  const { repo, adapter } = setup();
  const a = await repo.create('bill', { amount: 10 });
  await repo.create('bill', { amount: 20 });
  await repo.softDelete('bill', a.id);
  assert.equal(await repo.get('bill', a.id), null);
  assert.equal((await repo.get('bill', a.id, { includeDeleted: true })).deleted, true);
  assert.equal((await repo.list('bill')).length, 1);
  assert.equal((await repo.list('bill', { includeDeleted: true })).length, 2);
  // l'outbox tiene una voce per record, con l'ultima versione
  const entry = (await adapter.outboxList()).find((e) => e.id === a.id);
  assert.equal(entry.updatedAt, (await repo.get('bill', a.id, { includeDeleted: true })).updatedAt);
});

test('outboxAck non rimuove una voce modificata nel frattempo', async () => {
  const { repo } = setup();
  const a = await repo.create('bill', { amount: 1 });
  const [sent] = await repo.outbox();
  await repo.update('bill', a.id, { amount: 2 });
  await repo.outboxAck([sent]);
  assert.equal((await repo.outbox()).length, 1);
  await repo.outboxAck(await repo.outbox());
  assert.equal((await repo.outbox()).length, 0);
});

test('batch scrive più record in un colpo solo', async () => {
  const { repo } = setup();
  const item = await repo.create('groceryItem', { name: 'Latte', archived: false });
  const out = await repo.batch([
    { entity: 'groceryPurchase', create: { normName: 'latte', date: '2026-11-03' } },
    { entity: 'groceryItem', id: item.id, patch: { archived: true } },
  ]);
  assert.equal(out.length, 2);
  assert.equal((await repo.get('groceryItem', item.id)).archived, true);
  assert.equal((await repo.list('groceryPurchase')).length, 1);
});

test('purge elimina solo le tombstone più vecchie di 180 giorni', async () => {
  const { repo, clock } = setup('2026-01-01T00:00:00.000Z');
  const old = await repo.create('bill', {});
  const keep = await repo.create('bill', {});
  const live = await repo.create('bill', {});
  await repo.softDelete('bill', old.id);
  clock.advance(100 * 86_400_000);
  await repo.softDelete('bill', keep.id);
  clock.advance((TOMBSTONE_TTL_DAYS - 99) * 86_400_000);
  assert.equal(await repo.purgeTombstones(), 1);
  const ids = (await repo.list('bill', { includeDeleted: true })).map((r) => r.id).sort();
  assert.deepEqual(ids, [keep.id, live.id].sort());
});

test('le scritture notificano le viste', async () => {
  const { repo } = setup();
  const before = entityVersion('vaccine').value;
  await repo.create('vaccine', { name: 'Tetano' });
  assert.equal(entityVersion('vaccine').value, before + 1);
});

test('seed al primo avvio: 5 categorie e settings, una volta sola', async () => {
  const { repo } = setup();
  assert.equal(await seedDefaults(repo), 6);
  const cats = await repo.list('groceryCategory');
  assert.deepEqual(cats.map((c) => c.name), ['Freschi', 'Dispensa', 'Bevande', 'Cura Casa', 'Altro']);
  assert.ok(cats.every((c) => c.builtin));
  const settings = await repo.get('settings', SETTINGS_ID);
  assert.equal(settings.healthLockEnabled, true);
  assert.equal(settings.reminderHour, 9);
  // categoria eliminata dall'utente: il seed non la ricrea
  await repo.softDelete('groceryCategory', cats[4].id);
  assert.equal(await seedDefaults(repo), 0);
  assert.equal((await repo.list('groceryCategory')).length, 4);
});

test('manutenzione all\'avvio: archivia gli spuntati da più di 6 ore come acquisti', async () => {
  const { repo, clock } = setup('2026-11-03T08:00:00.000Z');
  const a = await repo.create('groceryItem', { name: 'Latte', normName: 'latte', categoryId: 'c', checkedAt: '2026-11-03T08:00:00.000Z', archived: false });
  const b = await repo.create('groceryItem', { name: 'Pane', normName: 'pane', categoryId: 'c', archived: false });
  clock.set('2026-11-03T14:00:01.000Z');
  assert.deepEqual(await startupMaintenance(repo, new Date('2026-11-03T14:00:01.000Z')), { purged: 0, archived: 1, installments: 0 });
  assert.equal((await repo.get('groceryItem', a.id)).archived, true);
  assert.equal((await repo.get('groceryItem', b.id)).archived, false);
  const [p] = await repo.list('groceryPurchase');
  assert.deepEqual([p.normName, p.date, p.categoryId], ['latte', '2026-11-03', 'c']);
});

import { ensureRentInstallments } from '../app/src/store/home.js';

test('rate d\'affitto generate per il contratto attivo, senza doppioni', async () => {
  const { repo } = setup();
  assert.equal(await ensureRentInstallments(repo, '2026-11-03'), 0); // nessun contratto
  await repo.create('rentContract', { totalAmount: 900, personalShare: 450, dueDay: 5, startDate: '2026-01-01' });
  const [a, b] = await Promise.all([ensureRentInstallments(repo, '2026-11-03'), ensureRentInstallments(repo, '2026-11-03')]);
  assert.equal(a + b, 2);
  const list = (await repo.list('rentInstallment')).map((i) => `${i.periodKey}:${i.dueDate}:${i.amount}`).sort();
  assert.deepEqual(list, ['2026-11:2026-11-05:900', '2026-12:2026-12-05:900']);
});

import { buildDemoRecords } from '../app/src/store/demo.js';
import { DEFAULT_CATEGORIES } from '../app/src/domain/groceries.js';

test('dati demo: tutti marcati, coerenti e relativi a oggi', () => {
  const categories = DEFAULT_CATEGORIES.map((c) => ({ ...c, id: `c-${c.normName}` }));
  const demo = buildDemoRecords('2026-11-03', categories);
  assert.ok(demo.length > 20);
  assert.ok(demo.every((r) => r.demo === true && r.entity && r.id));
  const vehicle = demo.find((r) => r.entity === 'vehicle');
  assert.ok(demo.filter((r) => r.entity === 'vehicleDeadline').every((d) => d.vehicleId === vehicle.id));
  assert.ok(demo.filter((r) => r.entity === 'groceryItem').every((i) => categories.some((c) => c.id === i.categoryId)));
  assert.equal(demo.find((r) => r.name === 'Latte').categoryId, 'c-freschi');
});
