import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRepo } from '../app/src/store/repo.js';
import { seedDefaults } from '../app/src/store/seed.js';
import { createAuth, AuthError, NetworkError, REFRESH_MARGIN_MS } from '../app/src/sync/auth.js';
import { createApi, normalizeTs, pullChanges, shiftTs } from '../app/src/sync/api.js';
import { createVault, fromBase64 } from '../app/src/sync/crypto.js';
import { META, mergeRemote, pullRemote, pushOutbox, remoteWins, runSync, stampAfter } from '../app/src/sync/sync.js';
import { createMemoryAdapter } from './helpers/memory-db.js';
import { createFakeSupabase, FAKE_KEY, FAKE_URL, pgTs } from './helpers/fake-supabase.js';

const EMAIL = 'simo@example.com';
const PASSWORD = 'password-giusta';

/** Un dispositivo: repo in memoria con orologio controllabile, auth e api verso il finto server. */
function device(server, name, start = '2026-11-03T10:00:00.000Z') {
  let now = Date.parse(start);
  let n = 0;
  const repo = createRepo(createMemoryAdapter(), {
    clock: () => new Date(now),
    uuid: () => `${name}-${String(++n).padStart(4, '0')}`,
  });
  const auth = createAuth({
    url: FAKE_URL, anonKey: FAKE_KEY, fetch: server.fetch, clock: () => now,
    load: () => repo.getMeta(META.session), save: (s) => repo.setMeta(META.session, s),
  });
  const api = createApi({ url: FAKE_URL, anonKey: FAKE_KEY, fetch: server.fetch, getAccessToken: (o) => auth.getAccessToken(o) });
  return {
    repo, auth, api,
    advance(ms) { now += ms; },
    get now() { return now; },
    async connect(key) { await auth.signIn(EMAIL, PASSWORD); this.key = key; },
    sync(opts = {}) { return runSync({ repo, api, key: this.key, ...opts }); },
  };
}

let sharedKey;
async function testKey() {
  sharedKey ??= (await createVault('passphrase di prova lunga', { iterations: 1000 })).key;
  return sharedKey;
}

const live = async (repo, entity) => (await repo.list(entity)).sort((a, b) => (a.id < b.id ? -1 : 1));

/* ---------- Istanti del server ---------- */

test('normalizeTs: timestamptz di Postgres → UTC a microsecondi, larghezza fissa', () => {
  assert.equal(normalizeTs('2026-11-03T12:00:00.1+00:00'), '2026-11-03T12:00:00.100000Z');
  assert.equal(normalizeTs('2026-11-03T12:00:00+00:00'), '2026-11-03T12:00:00.000000Z');
  assert.equal(normalizeTs('2026-11-03 13:00:00.123456+01'), '2026-11-03T12:00:00.123456Z');
  assert.equal(normalizeTs('2026-11-03T12:00:00.123456789Z'), '2026-11-03T12:00:00.123456Z');
  assert.throws(() => normalizeTs('ieri'), /non valido/);
  // l'ordine come stringa è l'ordine nel tempo
  assert.ok(normalizeTs('2026-11-03T12:00:00.9+00:00') > normalizeTs('2026-11-03T12:00:00.10001+00:00'));
  assert.ok(normalizeTs('2026-11-03T12:00:00.09+00:00') < normalizeTs('2026-11-03T12:00:00.1+00:00'));
});

test('shiftTs conserva i microsecondi e attraversa i secondi', () => {
  assert.equal(shiftTs('2026-11-03T12:00:00.000100Z', -5000), '2026-11-03T11:59:55.000100Z');
  assert.equal(shiftTs('2026-11-03T12:00:00.000100Z', -1), '2026-11-03T11:59:59.999100Z');
  assert.equal(shiftTs('2026-12-31T23:59:59.999999Z', 1), '2027-01-01T00:00:00.000999Z');
});

test('pullChanges: righe con lo stesso server_ts a cavallo delle pagine, ognuna letta una volta', async () => {
  const ts = (us) => pgTs(Date.parse('2026-11-03T10:00:00Z') * 1000 + us);
  const all = [
    { id: 'a', server_ts: ts(1) },
    { id: 'b', server_ts: ts(5) }, { id: 'c', server_ts: ts(5) }, { id: 'd', server_ts: ts(5) },
    { id: 'e', server_ts: ts(5) }, { id: 'f', server_ts: ts(5) },
    { id: 'g', server_ts: ts(9) },
  ];
  const queries = [];
  const fetchPage = async ({ since, offset, limit }) => {
    queries.push({ since, offset });
    const from = since ? all.filter((r) => normalizeTs(r.server_ts) >= since) : all;
    return from.slice(offset, offset + limit);
  };
  const seen = [];
  const res = await pullChanges(fetchPage, null, { pageSize: 2, onPage: async (rows) => { seen.push(...rows.map((r) => r.id)); } });
  assert.deepEqual(seen, ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  assert.equal(res.rows, 7);
  assert.equal(res.cursor, normalizeTs(ts(9)));
  assert.ok(queries.some((q) => q.offset > 2), 'blocco di pari merito saltato con offset crescente');

  // dal cursore: si rilegge una finestra di 5 s prima (le righe ripetute vengono scartate dal merge)
  const again = [];
  const res2 = await pullChanges(fetchPage, res.cursor, { pageSize: 10, onPage: async (rows) => { again.push(...rows.map((r) => r.id)); } });
  assert.deepEqual(again, ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  assert.equal(res2.cursor, res.cursor);
});

/* ---------- Merge last-writer-wins ---------- */

test('remoteWins: vince il più recente; a parità resta il locale', () => {
  const local = { updatedAt: '2026-11-03T10:00:00.000Z', deleted: false };
  assert.equal(remoteWins(null, local), true);
  assert.equal(remoteWins(local, { updatedAt: '2026-11-03T10:00:00.001Z' }), true);
  assert.equal(remoteWins(local, { updatedAt: '2026-11-03T09:59:59.999Z' }), false);
  assert.equal(remoteWins(local, { updatedAt: '2026-11-03T10:00:00.000Z' }), false);
  // updated_at di Postgres (+00:00) confrontato come istante, non come stringa
  assert.equal(remoteWins(local, { updatedAt: '2026-11-03T10:00:00.5+00:00' }), true);
  // primo collegamento: il cloud prevale anche se più vecchio
  assert.equal(remoteWins(local, { updatedAt: '2026-11-01T00:00:00.000Z' }, { preferRemote: true }), true);
  assert.equal(remoteWins(local, { ...local }, { preferRemote: true }), false);
});

test('mergeRemote: conflitti, tombstone e righe ripetute', () => {
  const L = (id, updatedAt, extra = {}) => ({ entity: 'bill', id, updatedAt, deleted: false, ...extra });
  const local = new Map([
    ['bill:1', L('1', '2026-11-03T10:00:00.000Z', { amount: 10 })],
    ['bill:2', L('2', '2026-11-03T12:00:00.000Z', { amount: 20 })],
    ['bill:3', L('3', '2026-11-03T10:00:00.000Z', { amount: 30 })],
  ]);
  const out = mergeRemote(local, [
    L('1', '2026-11-03T11:00:00.000Z', { amount: 11 }), // remoto più nuovo → vince
    L('2', '2026-11-03T11:00:00.000Z', { amount: 21 }), // remoto più vecchio → resta il locale
    L('3', '2026-11-03T10:30:00.000Z', { deleted: true }), // eliminazione più recente → tombstone
    L('4', '2026-11-03T09:00:00.000Z', { amount: 40 }), // nuovo
    L('4', '2026-11-03T08:00:00.000Z', { amount: 39 }), // ripetuto e più vecchio → ignorato
  ]);
  const byId = Object.fromEntries(out.map((r) => [r.id, r]));
  assert.deepEqual(Object.keys(byId).sort(), ['1', '3', '4']);
  assert.equal(byId[1].amount, 11);
  assert.equal(byId[3].deleted, true);
  assert.equal(byId[4].amount, 40);
});

test('stampAfter: le correzioni della dedupe superano anche orologi avanti', () => {
  const now = '2026-11-03T10:00:00.000Z';
  assert.equal(stampAfter(now, [{ updatedAt: '2026-11-03T09:00:00.000Z' }]), now);
  assert.equal(stampAfter(now, [{ updatedAt: '2026-11-03T10:05:00.000Z' }]), '2026-11-03T10:05:00.001Z');
});

/* ---------- Auth ---------- */

test('auth: credenziali sbagliate, accesso, sessione salvata', async () => {
  const server = createFakeSupabase();
  const d = device(server, 'A');
  await assert.rejects(d.auth.signIn(EMAIL, 'sbagliata'), (err) => err instanceof AuthError && err.code === 'invalid_credentials' && /non corretti/.test(err.message));
  const s = await d.auth.signIn(` ${EMAIL} `, PASSWORD);
  assert.equal(s.user.email, EMAIL);
  assert.equal((await d.repo.getMeta(META.session)).refreshToken, s.refreshToken);
  assert.equal(await d.auth.getAccessToken(), s.accessToken);
});

test('auth: refresh automatico vicino alla scadenza, una sola richiesta per più chiamate', async () => {
  const server = createFakeSupabase();
  const d = device(server, 'A');
  const first = await d.auth.signIn(EMAIL, PASSWORD);
  d.advance(3600_000 - REFRESH_MARGIN_MS + 1);
  const tokens = await Promise.all([d.auth.getAccessToken(), d.auth.getAccessToken(), d.auth.getAccessToken()]);
  assert.equal(new Set(tokens).size, 1);
  assert.notEqual(tokens[0], first.accessToken);
  assert.equal(server.state.calls.filter((c) => c.search === '?grant_type=refresh_token').length, 1);
  const saved = await d.repo.getMeta(META.session);
  assert.notEqual(saved.refreshToken, first.refreshToken, 'refresh token ruotato e salvato');
});

test('auth: refresh token non più valido → sessione scaduta e cancellata', async () => {
  const server = createFakeSupabase();
  const d = device(server, 'A');
  await d.auth.signIn(EMAIL, PASSWORD);
  await d.repo.setMeta(META.session, { ...(await d.repo.getMeta(META.session)), refreshToken: 'rt-falso' });
  const fresh = createAuth({
    url: FAKE_URL, anonKey: FAKE_KEY, fetch: server.fetch, clock: () => d.now,
    load: () => d.repo.getMeta(META.session), save: (s) => d.repo.setMeta(META.session, s),
  });
  await assert.rejects(fresh.getAccessToken({ force: true }), (err) => err.code === 'session_expired');
  assert.equal(await d.repo.getMeta(META.session), null);
  await assert.rejects(fresh.getAccessToken(), (err) => err.code === 'not_signed_in');
});

test('auth: logout revoca il token sul server e cancella la sessione; offline la cancella comunque', async () => {
  const server = createFakeSupabase();
  const d = device(server, 'A');
  const s = await d.auth.signIn(EMAIL, PASSWORD);
  await d.auth.signOut();
  assert.equal(server.tokens.has(s.accessToken), false);
  assert.equal(await d.repo.getMeta(META.session), null);
  await d.auth.signIn(EMAIL, PASSWORD);
  server.state.offline = true;
  await d.auth.signOut();
  assert.equal(await d.repo.getMeta(META.session), null);
});

test('api: un 401 rinnova il token e ripete la chiamata', async () => {
  const server = createFakeSupabase();
  const d = device(server, 'A');
  await d.auth.signIn(EMAIL, PASSWORD);
  server.expireAllTokens(); // il server rifiuta, il client crede il token ancora valido
  assert.equal(await d.api.getVault(), null);
  assert.equal(server.state.calls.filter((c) => c.search === '?grant_type=refresh_token').length, 1);
});

test('api: vault creato una volta sola; il secondo tentativo risponde false', async () => {
  const server = createFakeSupabase();
  const d = device(server, 'A');
  await d.auth.signIn(EMAIL, PASSWORD);
  const { vault } = await createVault('passphrase di prova', { iterations: 1000 });
  assert.equal(await d.api.createVault(vault), true);
  assert.equal(await d.api.createVault(vault), false);
  assert.deepEqual(await d.api.getVault(), vault);
});

/* ---------- Sync end-to-end tra due dispositivi ---------- */

test('primo dispositivo: invia tutto cifrato; nel cloud niente in chiaro', async () => {
  const server = createFakeSupabase();
  const key = await testKey();
  const A = device(server, 'A');
  await A.connect(key);
  await A.repo.create('vehicle', { name: 'T-Cross', plate: 'GH 123 XY', currentKm: 12000 });
  await A.repo.create('medicalVisit', { type: 'dentista', doctor: 'Dott.ssa Rossi' });
  const res = await A.sync();
  assert.equal(res.initial, true);
  assert.equal(res.pushed, 2);
  assert.equal((await A.repo.outbox()).length, 0);
  const rows = server.rows();
  assert.equal(rows.length, 2);
  for (const r of rows) {
    const raw = Buffer.from(fromBase64(r.payload)).toString('latin1');
    for (const secret of ['GH 123', 'Rossi', 'dentista', 'T-Cross']) assert.ok(!raw.includes(secret));
    assert.deepEqual(Object.keys(r).sort(), ['deleted', 'entity', 'id', 'iv', 'payload', 'server_micros', 'updated_at', 'user_id']);
  }
  assert.ok(await A.repo.getMeta(META.initialDone));
  // cloud vuoto al primo giro: il cursore arriva con la sync successiva, che non riscrive nulla
  const second = await A.sync();
  assert.equal(second.initial, false);
  assert.equal(second.applied, 0);
  assert.equal(second.pushed, 0);
  assert.ok(await A.repo.getMeta(META.cursor));
});

test('secondo dispositivo: riceve i dati, il cloud prevale su settings e le categorie predefinite si fondono', async () => {
  const server = createFakeSupabase();
  const key = await testKey();
  const A = device(server, 'A', '2026-11-01T09:00:00.000Z');
  await seedDefaults(A.repo);
  await A.repo.update('settings', 'settings', { profileName: 'Simone', reminderHour: 8 });
  await A.repo.create('vehicle', { name: 'T-Cross', plate: 'GH123XY' });
  await A.connect(key);
  await A.sync();

  // B nasce dopo: le sue impostazioni predefinite sono più recenti, ma non devono vincere
  const B = device(server, 'B', '2026-11-03T09:00:00.000Z');
  await seedDefaults(B.repo);
  await B.connect(key);
  const res = await B.sync();
  assert.equal(res.initial, true);
  const settingsB = await B.repo.get('settings', 'settings');
  assert.equal(settingsB.profileName, 'Simone');
  assert.equal(settingsB.reminderHour, 8);
  assert.equal((await live(B.repo, 'vehicle')).length, 1);
  assert.equal((await live(B.repo, 'groceryCategory')).length, 5, 'doppioni per normName eliminati');

  await A.sync();
  const catsA = (await live(A.repo, 'groceryCategory')).map((c) => c.id);
  const catsB = (await live(B.repo, 'groceryCategory')).map((c) => c.id);
  assert.deepEqual(catsA, catsB, 'stesse categorie su entrambi');
  assert.equal((await A.repo.get('settings', 'settings')).profileName, 'Simone');
});

test('conflitto offline sullo stesso record: vince la modifica più recente, in qualunque ordine si sincronizzi', async () => {
  for (const order of [['A', 'B'], ['B', 'A']]) {
    const server = createFakeSupabase();
    const key = await testKey();
    const A = device(server, 'A');
    const B = device(server, 'B');
    await A.connect(key);
    await B.connect(key);
    const v = await A.repo.create('vehicle', { name: 'T-Cross', plate: 'GH123XY', currentKm: 500 });
    await A.sync();
    await B.sync();

    A.advance(60_000); B.advance(120_000); // offline: A modifica prima, B dopo
    await A.repo.update('vehicle', v.id, { currentKm: 1000, color: 'grigio' });
    await B.repo.update('vehicle', v.id, { currentKm: 2000 });

    const devices = { A, B };
    for (const name of order) await devices[name].sync();
    for (const name of order) await devices[name].sync();

    for (const d of [A, B]) {
      const got = await d.repo.get('vehicle', v.id);
      assert.equal(got.currentKm, 2000, `ordine ${order.join('→')}`);
      assert.equal(got.color, undefined, 'last-writer-wins per record intero');
    }
    // il server non ha accettato la versione più vecchia sopra la più nuova
    assert.equal(server.rows().length, 1);
  }
});

test('eliminazione: la tombstone arriva all\'altro dispositivo', async () => {
  const server = createFakeSupabase();
  const key = await testKey();
  const A = device(server, 'A');
  const B = device(server, 'B');
  await A.connect(key);
  await B.connect(key);
  const visit = await A.repo.create('medicalVisit', { type: 'oculista' });
  await A.sync();
  await B.sync();
  assert.ok(await B.repo.get('medicalVisit', visit.id));
  A.advance(1000);
  await A.repo.softDelete('medicalVisit', visit.id);
  await A.sync();
  await B.sync();
  assert.equal(await B.repo.get('medicalVisit', visit.id), null);
  assert.equal((await B.repo.get('medicalVisit', visit.id, { includeDeleted: true })).deleted, true);
  assert.equal(server.rows().find((r) => r.id === visit.id).deleted, true);
});

test('dedupe dopo la sync: stesso veicolo creato offline su due dispositivi', async () => {
  const server = createFakeSupabase();
  const key = await testKey();
  const A = device(server, 'A');
  const B = device(server, 'B');
  await A.connect(key);
  await B.connect(key);
  await A.sync();
  await B.sync();

  const va = await A.repo.create('vehicle', { name: 'T-Cross', plate: 'GH 123 XY' });
  await A.repo.create('mileageReading', { vehicleId: va.id, date: '2026-11-02', km: 12000 });
  B.advance(5000);
  const vb = await B.repo.create('vehicle', { name: 'TCross', plate: 'gh123xy' });
  await B.repo.create('mileageReading', { vehicleId: vb.id, date: '2026-11-03', km: 12100 });
  await B.repo.create('groceryItem', { name: 'Latte', normName: 'latte', quantity: 2, urgency: 'normale', archived: false });
  await A.repo.create('groceryItem', { name: 'latte', normName: 'latte', quantity: 1, urgency: 'urgente', archived: false });

  const res = await A.sync();
  await B.sync();
  await A.sync();
  assert.equal(res.deduped, 0, 'A non vede ancora i dati di B');

  for (const d of [A, B]) {
    const vehicles = await live(d.repo, 'vehicle');
    assert.equal(vehicles.length, 1);
    assert.equal(vehicles[0].id, vb.id, 'vince il più recente');
    const readings = await live(d.repo, 'mileageReading');
    assert.equal(readings.length, 2);
    assert.ok(readings.every((r) => r.vehicleId === vb.id), 'letture ricollegate al vincitore');
    const items = await live(d.repo, 'groceryItem');
    assert.equal(items.length, 1);
    assert.equal(items[0].quantity, 2);
    assert.equal(items[0].urgency, 'urgente');
  }
  assert.equal(server.rows().find((r) => r.id === va.id).deleted, true, 'il perdente è tombstone anche nel cloud');
});

test('push a lotti di 200 via RPC', async () => {
  const server = createFakeSupabase();
  const key = await testKey();
  const A = device(server, 'A');
  await A.connect(key);
  await A.sync();
  await A.repo.batch(Array.from({ length: 450 }, (_, i) => ({ entity: 'groceryPurchase', create: { normName: `p${i}`, name: `P${i}`, date: '2026-11-03' } })));
  server.state.calls.length = 0;
  const pushed = await pushOutbox({ repo: A.repo, api: A.api, key });
  assert.equal(pushed, 450);
  const sizes = server.state.calls.filter((c) => c.path === '/rest/v1/rpc/upsert_records').map((c) => c.body.rows.length);
  assert.deepEqual(sizes, [200, 200, 50]);
  assert.equal((await A.repo.outbox()).length, 0);
});

test('pull paginato con molte righe allo stesso server_ts', async () => {
  const server = createFakeSupabase();
  const key = await testKey();
  const A = device(server, 'A');
  const B = device(server, 'B');
  await A.connect(key);
  await B.connect(key);
  server.state.frozenTs = server.currentMicros();
  await A.repo.batch(Array.from({ length: 7 }, (_, i) => ({ entity: 'bill', create: { kind: 'luce', amount: i } })));
  await A.sync();
  const res = await pullRemote({ repo: B.repo, api: B.api, key, cursor: null, pageSize: 3 });
  assert.equal(res.received, 7);
  assert.equal(res.applied, 7);
  assert.equal((await live(B.repo, 'bill')).length, 7);
  assert.equal((await B.repo.outbox()).length, 0, 'i record ricevuti non tornano in coda');
});

test('rete assente: la sync fallisce senza perdere la coda né spostare il cursore; poi riprende', async () => {
  const server = createFakeSupabase();
  const key = await testKey();
  const A = device(server, 'A');
  await A.connect(key);
  await A.sync();
  const cursor = await A.repo.getMeta(META.cursor);
  await A.repo.create('bill', { kind: 'gas', amount: 42 });
  server.state.offline = true;
  await assert.rejects(A.sync(), NetworkError);
  assert.equal((await A.repo.outbox()).length, 1);
  assert.equal(await A.repo.getMeta(META.cursor), cursor);
  server.state.offline = false;
  server.state.failNext = 1; // un 503 transitorio
  await assert.rejects(A.sync(), (err) => err.status === 503);
  const res = await A.sync();
  assert.equal(res.pushed, 1);
  assert.equal((await A.repo.outbox()).length, 0);
});

test('outbox: una tombstone già eliminata in locale esce dalla coda senza invio', async () => {
  const server = createFakeSupabase();
  const key = await testKey();
  const A = device(server, 'A');
  await A.connect(key);
  await A.sync();
  const b = await A.repo.create('bill', { kind: 'acqua' });
  await A.repo.softDelete('bill', b.id);
  A.advance(200 * 86_400_000);
  assert.equal(await A.repo.purgeTombstones(), 1);
  assert.equal(await pushOutbox({ repo: A.repo, api: A.api, key }), 0);
  assert.equal((await A.repo.outbox()).length, 0);
});

test('solo invio (uscendo dall\'app): manda la coda senza leggere dal cloud', async () => {
  const server = createFakeSupabase();
  const key = await testKey();
  const A = device(server, 'A');
  await A.connect(key);
  await A.sync();
  await A.repo.create('bill', { kind: 'internet', amount: 25 });
  server.state.calls.length = 0;
  const res = await A.sync({ pushOnly: true });
  assert.equal(res.pushed, 1);
  assert.ok(!server.state.calls.some((c) => c.path === '/rest/v1/records'), 'nessuna lettura');
});

test('conteggio dei record nel cloud (esclude le tombstone)', async () => {
  const server = createFakeSupabase();
  const key = await testKey();
  const A = device(server, 'A');
  await A.connect(key);
  const x = await A.repo.create('bill', { kind: 'luce' });
  await A.repo.create('bill', { kind: 'gas' });
  await A.repo.softDelete('bill', x.id);
  await A.sync();
  assert.equal(await A.api.countRecords(), 1);
});
