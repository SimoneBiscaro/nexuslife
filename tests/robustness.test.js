import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRepo } from '../app/src/store/repo.js';
import { DB_VERSION, MIGRATIONS, openDatabase } from '../app/src/store/db.js';
import { clockCorrection, createAuth, sessionFrom, SKEW_TOLERANCE_MS, tokenIssuedAt } from '../app/src/sync/auth.js';
import { createApi } from '../app/src/sync/api.js';
import { createVault } from '../app/src/sync/crypto.js';
import { META, runSync } from '../app/src/sync/sync.js';
import { createMemoryAdapter } from './helpers/memory-db.js';
import { createFakeSupabase, FAKE_KEY, FAKE_URL } from './helpers/fake-supabase.js';
import { createFakeIndexedDB } from './helpers/fake-idb.js';

const EMAIL = 'simo@example.com';
const PASSWORD = 'password-giusta';
const START = Date.parse('2026-11-03T10:00:00.000Z');
let sharedKey;
const testKey = async () => (sharedKey ??= (await createVault('passphrase di prova lunga', { iterations: 1000 })).key);

/**
 * Mondo con un'ora "vera" (quella del server) e dispositivi con orologi sfasati di `skewMs`.
 * Con `correct` il dispositivo applica la correzione stimata dal token, come fa l'app.
 */
function world() {
  let real = START;
  const server = createFakeSupabase();
  server.state.now = () => real;
  return {
    server,
    advance(ms) { real += ms; },
    device(name, { skewMs = 0, correct = true } = {}) {
      let offset = 0;
      let n = 0;
      const local = () => real + skewMs;
      const repo = createRepo(createMemoryAdapter(), {
        clock: () => new Date(local() + offset),
        uuid: () => `${name}-${String(++n).padStart(4, '0')}`,
      });
      const auth = createAuth({
        url: FAKE_URL, anonKey: FAKE_KEY, fetch: server.fetch, clock: local,
        load: () => repo.getMeta(META.session),
        save: async (s) => {
          await repo.setMeta(META.session, s);
          if (correct && s) offset = clockCorrection(s.skewMs);
        },
      });
      const api = createApi({ url: FAKE_URL, anonKey: FAKE_KEY, fetch: server.fetch, getAccessToken: (o) => auth.getAccessToken(o) });
      return {
        repo, auth, api,
        get offset() { return offset; },
        async connect() { await auth.signIn(EMAIL, PASSWORD); this.key = await testKey(); },
        sync(o = {}) { return runSync({ repo, api: o.api ?? api, key: this.key, ...o }); },
      };
    },
  };
}

/* ---------- Orologio sbagliato ---------- */

test('iat del token e correzione dell\'orologio', () => {
  const jwt = (claims) => `x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.y`;
  assert.equal(tokenIssuedAt(jwt({ iat: 1_800_000_000 })), 1_800_000_000_000);
  assert.equal(tokenIssuedAt('non-un-jwt'), null);
  assert.equal(tokenIssuedAt(jwt({ sub: 'u' })), null);
  assert.equal(clockCorrection(null), 0);
  assert.equal(clockCorrection(SKEW_TOLERANCE_MS - 1), 0, 'entro la tolleranza: nessuna correzione');
  assert.equal(clockCorrection(-240_000), -240_000);
  // scadenza calcolata con expires_in e orologio locale, non con expires_at del server
  const now = Date.parse('2026-11-03T10:00:00Z');
  const s = sessionFrom({ access_token: jwt({ iat: now / 1000 + 300 }), refresh_token: 'r', expires_in: 3600, expires_at: now / 1000 + 300 + 3600 }, now);
  assert.equal(s.expiresAt, now + 3600_000);
  assert.equal(s.skewMs, 300_000);
});

test('telefono indietro di 5 minuti: con la correzione vince comunque la modifica fatta dopo', async () => {
  for (const correct of [true, false]) {
    const w = world();
    const mac = w.device('mac');
    const phone = w.device('phone', { skewMs: -5 * 60_000, correct });
    await mac.connect();
    await phone.connect();
    assert.equal(phone.offset, correct ? 5 * 60_000 : 0);
    const v = await mac.repo.create('vehicle', { name: 'T-Cross', plate: 'GH123XY', currentKm: 1000 });
    await mac.sync();
    await phone.sync();

    w.advance(60_000);
    await mac.repo.update('vehicle', v.id, { currentKm: 1100 }); // prima il Mac
    w.advance(60_000);
    await phone.repo.update('vehicle', v.id, { currentKm: 1200 }); // un minuto dopo il telefono
    await mac.sync(); await phone.sync(); await mac.sync();

    const kmMac = (await mac.repo.get('vehicle', v.id)).currentKm;
    const kmPhone = (await phone.repo.get('vehicle', v.id)).currentKm;
    assert.equal(kmMac, kmPhone, 'i due dispositivi convergono comunque');
    // senza correzione il telefono "torna indietro nel tempo" e la sua modifica, più recente, perde
    assert.equal(kmMac, correct ? 1200 : 1100);
  }
});

test('telefono avanti di 5 minuti: il token non sembra scaduto e la correzione è negativa', async () => {
  const w = world();
  const phone = w.device('phone', { skewMs: 5 * 60_000 });
  await phone.connect();
  assert.equal(phone.offset, -5 * 60_000);
  w.server.state.calls.length = 0;
  await phone.api.getVault();
  assert.equal(w.server.state.calls.filter((c) => c.search.includes('refresh_token')).length, 0, 'nessun refresh inutile');
});

/* ---------- Chiusura dell'app a metà sync ---------- */

/** api che "muore" (come un'app chiusa) al passo indicato. */
function crashing(api, { method, after = 0, afterSuccess = false }) {
  let calls = 0;
  return {
    ...api,
    async [method](...args) {
      calls++;
      if (calls > after) {
        if (afterSuccess) await api[method](...args);
        throw new Error('app chiusa');
      }
      return api[method](...args);
    },
  };
}

test('chiusura dopo l\'invio ma prima della conferma: si reinvia, nessun dato perso né duplicato', async () => {
  const w = world();
  const A = w.device('A');
  const B = w.device('B');
  await A.connect(); await B.connect();
  await A.sync(); await B.sync();
  await A.repo.batch(Array.from({ length: 5 }, (_, i) => ({ entity: 'bill', create: { kind: 'luce', amount: i } })));
  await assert.rejects(A.sync({ api: crashing(A.api, { method: 'upsertRecords', afterSuccess: true }) }), /app chiusa/);
  assert.equal(w.server.rows().length, 5, 'il server ha già i dati');
  assert.equal((await A.repo.outbox()).length, 5, 'ma la coda è intatta');
  await A.sync();
  assert.equal((await A.repo.outbox()).length, 0);
  assert.equal(w.server.rows().length, 5);
  await B.sync();
  assert.equal((await B.repo.list('bill')).length, 5);
});

test('chiusura a metà download: il cursore non avanza e la sync successiva completa', async () => {
  const w = world();
  const A = w.device('A');
  const B = w.device('B');
  await A.connect(); await B.connect();
  await A.repo.batch(Array.from({ length: 1200 }, (_, i) => ({ entity: 'groceryPurchase', create: { normName: `p${i}`, name: `P${i}`, date: '2026-11-01' } })));
  await A.sync();
  await B.sync(); // primo collegamento di B (cloud già pieno)
  w.server.tick(60_000_000); // passa un minuto sul server
  await A.repo.batch(Array.from({ length: 700 }, (_, i) => ({ entity: 'bill', create: { kind: 'gas', amount: i } })));
  await A.sync();
  const cursor = await B.repo.getMeta(META.cursor);
  // pagine da 500: le prime due rileggono la finestra prima del cursore, la terza porta le prime bollette
  await assert.rejects(B.sync({ api: crashing(B.api, { method: 'fetchChanges', after: 3 }) }), /app chiusa/);
  assert.equal(await B.repo.getMeta(META.cursor), cursor, 'cursore fermo');
  const partial = (await B.repo.list('bill')).length;
  assert.ok(partial > 0 && partial < 700, `download a metà (${partial} bollette)`);
  await B.sync();
  assert.equal((await B.repo.list('bill')).length, 700);
  assert.equal((await B.repo.list('groceryPurchase')).length, 1200);
});

test('chiusura dopo la dedupe ma prima di inviarla: le correzioni restano in coda e arrivano dopo', async () => {
  const w = world();
  const A = w.device('A');
  const B = w.device('B');
  await A.connect(); await B.connect();
  await A.sync(); await B.sync();
  await A.repo.create('vehicle', { plate: 'GH123XY', name: 'A' });
  w.advance(1000);
  await B.repo.create('vehicle', { plate: 'gh 123 xy', name: 'B' });
  await A.sync();
  // B scarica il veicolo di A, deduplica, poi muore all'invio finale
  await assert.rejects(B.sync({ api: crashing(B.api, { method: 'upsertRecords', after: 1 }) }), /app chiusa/);
  assert.equal((await B.repo.list('vehicle')).length, 1);
  assert.ok((await B.repo.outbox()).length >= 1, 'tombstone del perdente in coda');
  await B.sync(); await A.sync();
  const live = (rows) => rows.filter((r) => r.entity === 'vehicle' && !r.deleted).length;
  assert.equal(live(w.server.rows()), 1);
  assert.equal((await A.repo.list('vehicle')).length, 1);
});

test('chiusura durante il primo collegamento: si ripete da capo e i dati locali non si perdono', async () => {
  const w = world();
  const A = w.device('A');
  const B = w.device('B');
  await A.connect(); await B.connect();
  await A.repo.create('bill', { kind: 'acqua', amount: 30 });
  await A.sync();
  await B.repo.create('bill', { kind: 'rifiuti', amount: 80 }); // creato su B prima di collegarlo
  await assert.rejects(B.sync({ api: crashing(B.api, { method: 'upsertRecords' }) }), /app chiusa/);
  assert.equal(await B.repo.getMeta(META.initialDone), undefined, 'primo collegamento non segnato come fatto');
  const res = await B.sync();
  assert.equal(res.initial, true);
  await A.sync();
  for (const d of [A, B]) assert.deepEqual((await d.repo.list('bill')).map((b) => b.kind).sort(), ['acqua', 'rifiuti']);
});

/* ---------- Migrazioni IndexedDB ---------- */

/** Schema atteso alla versione corrente. Una modifica allo schema deve aggiornare questo e DB_VERSION. */
const EXPECTED_SCHEMA = {
  records: { keyPath: ['entity', 'id'], indexes: { entity: 'entity', updatedAt: 'updatedAt' } },
  outbox: { keyPath: 'key', indexes: {} },
  meta: { keyPath: 'key', indexes: {} },
};

test('ogni versione dello schema ha la sua migrazione', () => {
  assert.ok(Number.isInteger(DB_VERSION) && DB_VERSION >= 1);
  for (let v = 1; v <= DB_VERSION; v++) assert.equal(typeof MIGRATIONS[v], 'function', `manca la migrazione ${v}`);
  assert.equal(Object.keys(MIGRATIONS).length, DB_VERSION, 'migrazioni oltre DB_VERSION: incrementa la versione');
});

test('installazione nuova: lo schema finale è quello atteso', async () => {
  const idb = createFakeIndexedDB();
  const db = await openDatabase('nl-test', idb);
  assert.equal(db.version, DB_VERSION);
  assert.deepEqual(idb.schema('nl-test'), EXPECTED_SCHEMA);
});

test('aggiornamento da ogni versione precedente: solo i passi mancanti, dati conservati', async () => {
  for (let from = 1; from <= DB_VERSION; from++) {
    const idb = createFakeIndexedDB();
    // archivio esistente alla versione `from`, con dei dati
    await new Promise((resolve, reject) => {
      const req = idb.open('nl-test', from);
      req.onupgradeneeded = (e) => { for (let v = e.oldVersion + 1; v <= from; v++) MIGRATIONS[v](req.result, req.transaction); };
      req.onsuccess = () => {
        idb.databases.get('nl-test').stores.get('records').rows.set('k', { entity: 'vehicle', id: '1', plate: 'GH123XY' });
        idb.databases.get('nl-test').stores.get('meta').rows.set('m', { key: 'sync.cursor', value: 'x' });
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
    const db = await openDatabase('nl-test', idb);
    assert.equal(db.version, DB_VERSION);
    assert.deepEqual(idb.schema('nl-test'), EXPECTED_SCHEMA, `da v${from}`);
    assert.deepEqual(idb.rows('nl-test', 'records'), [{ entity: 'vehicle', id: '1', plate: 'GH123XY' }]);
    assert.equal(idb.rows('nl-test', 'meta')[0].value, 'x');
  }
});

test('archivio di una versione più nuova dell\'app: errore VersionError gestibile', async () => {
  const idb = createFakeIndexedDB();
  idb.databases.set('nl-test', { version: DB_VERSION + 1, stores: new Map() });
  await assert.rejects(openDatabase('nl-test', idb), (err) => err.name === 'VersionError');
});

test('una migrazione che fallisce non lascia lo schema a metà versione', async () => {
  const idb = createFakeIndexedDB();
  const req = idb.open('nl-test', 1);
  await new Promise((resolve) => {
    req.onupgradeneeded = () => { req.result.createObjectStore('records', { keyPath: 'id' }); throw new Error('migrazione rotta'); };
    req.onerror = resolve;
  });
  assert.equal(idb.databases.get('nl-test').version, 0);
});
