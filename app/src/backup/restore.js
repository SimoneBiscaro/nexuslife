/*
 * Ripristino da pacchetto: accetta .zip, .nxbak o nexuslife.json, verifica gli hash del manifest,
 * prepara l'anteprima e calcola le modifiche per "Unisci" o "Sostituisci tutto".
 */
import { readZip } from './zip.js';
import { decryptPackage, FORMAT, isNxbak } from './package.js';
import { sha256Hex } from '../sync/crypto.js';
import { dedupe } from '../domain/dedupe.js';

const dec = new TextDecoder();

export class PassphraseRequired extends Error {
  constructor() { super('Il pacchetto è protetto da passphrase'); this.code = 'passphrase'; }
}

export const SECTION_OF = {
  vehicle: 'Auto', vehicleDeadline: 'Auto', mileageReading: 'Auto', vehicleExpense: 'Auto',
  rentContract: 'Casa', rentInstallment: 'Casa', bill: 'Casa', homeMaintenance: 'Casa', homePurchase: 'Casa',
  groceryCategory: 'Spesa', groceryItem: 'Spesa', groceryPurchase: 'Spesa', suggestionFeedback: 'Spesa',
  medicalVisit: 'Salute', vaccine: 'Salute', settings: 'Impostazioni',
};

function parseJson(bytes) {
  let doc;
  try { doc = JSON.parse(dec.decode(bytes)); } catch { throw new Error('nexuslife.json non è leggibile'); }
  if (doc?.format !== FORMAT || !Array.isArray(doc.records)) throw new Error('Il file non è un backup di NexusLife');
  for (const r of doc.records) {
    if (!r || typeof r.entity !== 'string' || typeof r.id !== 'string' || typeof r.updatedAt !== 'string') {
      throw new Error('Il backup contiene record non validi');
    }
  }
  return doc;
}

/**
 * Legge un pacchetto.
 * @param {Uint8Array} bytes
 * @param {{ passphrase?: string }} [opts]
 * @returns {Promise<{ kind: 'zip'|'nxbak'|'json', verified: boolean, meta: object, records: Array<object> }>}
 */
export async function readBackup(bytes, { passphrase } = {}) {
  let kind = 'zip';
  let data = bytes;
  if (isNxbak(bytes)) {
    if (!passphrase) throw new PassphraseRequired();
    data = await decryptPackage(bytes, passphrase);
    kind = 'nxbak';
  } else if (bytes[0] === 0x7B || (bytes[0] === 0xEF && bytes[3] === 0x7B)) {
    const doc = parseJson(bytes);
    return { kind: 'json', verified: false, meta: metaOf(doc), records: doc.records };
  } else if (!(bytes[0] === 0x50 && bytes[1] === 0x4B)) {
    throw new Error('Formato non riconosciuto: scegli un file .zip, .nxbak o nexuslife.json');
  }

  const files = new Map(readZip(data).map((f) => [f.name, f.data]));
  const manifestBytes = files.get('manifest.json');
  if (!manifestBytes) throw new Error('Manca manifest.json: il pacchetto non è completo');
  const manifest = JSON.parse(dec.decode(manifestBytes));
  const broken = [];
  for (const f of manifest.files || []) {
    const content = files.get(f.name);
    if (!content || (await sha256Hex(content)) !== f.sha256) broken.push(f.name);
  }
  if (broken.length) throw new Error(`Verifica fallita: ${broken.join(', ')} non corrisponde al manifest`);
  const json = files.get('nexuslife.json');
  if (!json) throw new Error('Manca nexuslife.json nel pacchetto');
  const doc = parseJson(json);
  return { kind, verified: true, meta: metaOf(doc), records: doc.records };
}

function metaOf(doc) {
  return { exportedAt: doc.exportedAt, appVersion: doc.appVersion, schemaVersion: doc.schemaVersion, excludeHealth: Boolean(doc.excludeHealth) };
}

/** Record per sezione per l'anteprima. */
export function summarize(records) {
  const out = {};
  for (const r of records) {
    if (r.deleted) continue;
    const s = SECTION_OF[r.entity] ?? 'Altro';
    out[s] = (out[s] || 0) + 1;
  }
  return out;
}

const key = (r) => `${r.entity}:${r.id}`;

/**
 * Unisci: per ogni record vince il più recente (updatedAt), poi deduplicazione.
 * @returns {Array<object>} record da scrivere
 */
export function planMerge(localRecords, incoming, now) {
  const merged = new Map(localRecords.map((r) => [key(r), r]));
  const changed = new Map();
  for (const r of incoming) {
    const local = merged.get(key(r));
    if (!local || r.updatedAt > local.updatedAt) {
      merged.set(key(r), r);
      changed.set(key(r), r);
    }
  }
  for (const r of dedupe([...merged.values()], now)) changed.set(key(r), r);
  return [...changed.values()];
}

/**
 * Sostituisci tutto: i record del pacchetto diventano quelli attuali (con updatedAt nuovo, così
 * vincono anche nel cloud) e tutti gli altri record locali diventano tombstone.
 * @returns {Array<object>}
 */
export function planReplace(localRecords, incoming, now) {
  const base = Date.parse(now);
  const localByKey = new Map(localRecords.map((r) => [key(r), r]));
  const stamp = (prev) => new Date(Math.max(base, prev ? Date.parse(prev) + 1 : 0)).toISOString();
  const keep = new Set();
  const out = [];
  for (const r of incoming) {
    if (r.deleted) continue;
    keep.add(key(r));
    out.push({ ...r, updatedAt: stamp(localByKey.get(key(r))?.updatedAt) });
  }
  for (const r of localRecords) {
    if (r.deleted || keep.has(key(r))) continue;
    out.push({ ...r, deleted: true, updatedAt: stamp(r.updatedAt) });
  }
  return out;
}
