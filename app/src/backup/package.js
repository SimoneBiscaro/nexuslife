/*
 * Pacchetto di backup (CLAUDE.md §8):
 * NexusLife_backup_AAAA-MM-GG.zip con nexuslife.json, csv/<entità>.csv, riepilogo.html e
 * manifest.json (SHA-256 di ogni file). Opzionale: cifratura in .nxbak e "Escludi Salute".
 */
import { createZip } from './zip.js';
import { columnsFor, toCsv } from './csv.js';
import { buildReport } from './report.js';
import { decryptBytes, deriveKey, encryptBytes, PBKDF2_ITERATIONS, randomBytes, sha256Hex } from '../sync/crypto.js';

/** 3: entità todo (Fase 10). 2: entità vehicleMaintenance, vehiclePurchase, visitPlan e campi delle manutenzioni una tantum (Fase 9). */
export const SCHEMA_VERSION = 3;
export const FORMAT = 'nexuslife-backup';
export const HEALTH_ENTITIES = ['medicalVisit', 'visitPlan', 'vaccine'];
export const ENTITY_ORDER = [
  'vehicle', 'vehicleDeadline', 'mileageReading', 'vehicleExpense', 'vehicleMaintenance', 'vehiclePurchase',
  'rentContract', 'rentInstallment', 'bill', 'homeMaintenance', 'homePurchase',
  'groceryCategory', 'groceryItem', 'groceryPurchase', 'suggestionFeedback',
  'medicalVisit', 'visitPlan', 'vaccine', 'todo', 'settings',
];

const enc = new TextEncoder();

export function backupFilename(today, encrypted = false) {
  return `NexusLife_backup_${today}.${encrypted ? 'nxbak' : 'zip'}`;
}

/** Record da esportare: non eliminati, senza Salute se richiesto. */
export function exportableRecords(records, { excludeHealth = false } = {}) {
  return records.filter((r) => !r.deleted && !(excludeHealth && HEALTH_ENTITIES.includes(r.entity)));
}

function byEntity(records) {
  const map = new Map();
  for (const r of records) {
    if (!map.has(r.entity)) map.set(r.entity, []);
    map.get(r.entity).push(r);
  }
  const rank = (e) => { const i = ENTITY_ORDER.indexOf(e); return i === -1 ? ENTITY_ORDER.length : i; };
  return [...map.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]));
}

/**
 * Crea lo ZIP del pacchetto.
 * @param {Array<object>} records tutti i record locali
 * @param {{ today: string, now: Date|string, appVersion: string, excludeHealth?: boolean }} opts
 * @returns {Promise<{ bytes: Uint8Array, filename: string, manifest: object, recordCount: number }>}
 */
export async function createBackupPackage(records, { today, now, appVersion, excludeHealth = false }) {
  const exportedAt = new Date(now).toISOString();
  const list = exportableRecords(records, { excludeHealth });
  const groups = byEntity(list);

  const files = [];
  const json = JSON.stringify({ format: FORMAT, schemaVersion: SCHEMA_VERSION, appVersion, exportedAt, excludeHealth, records: list }, null, 2);
  files.push({ name: 'nexuslife.json', data: enc.encode(json), records: list.length });
  for (const [entity, rows] of groups) {
    files.push({ name: `csv/${entity}.csv`, data: enc.encode(toCsv(rows, columnsFor(rows))), records: rows.length });
  }
  files.push({ name: 'riepilogo.html', data: enc.encode(buildReport(list, { today, now: exportedAt, appVersion, excludeHealth })) });

  const manifest = {
    format: FORMAT, schemaVersion: SCHEMA_VERSION, appVersion, exportedAt, excludeHealth,
    files: await Promise.all(files.map(async (f) => ({
      name: f.name, size: f.data.length, sha256: await sha256Hex(f.data), ...(f.records !== undefined ? { records: f.records } : {}),
    }))),
  };
  const zip = createZip([
    ...files.map((f) => ({ name: f.name, data: f.data })),
    { name: 'manifest.json', data: enc.encode(JSON.stringify(manifest, null, 2)) },
  ], { date: new Date(exportedAt) });

  return { bytes: zip, filename: backupFilename(today, false), manifest, recordCount: list.length };
}

/* ---------- .nxbak: lo ZIP cifrato ----------
 * Intestazione: "NXBAK" (5 byte) · versione (1) · iterazioni (uint32 BE) · salt (16) · iv (12) · dati cifrati.
 */
export const NXBAK_MAGIC = [0x4E, 0x58, 0x42, 0x41, 0x4B];
const HEADER = 5 + 1 + 4 + 16 + 12;

export function isNxbak(bytes) {
  return bytes.length > HEADER && NXBAK_MAGIC.every((b, i) => bytes[i] === b);
}

export async function encryptPackage(bytes, passphrase, { iterations = PBKDF2_ITERATIONS } = {}) {
  const salt = randomBytes(16);
  const key = await deriveKey(passphrase, salt, iterations);
  const { iv, data } = await encryptBytes(key, bytes);
  const out = new Uint8Array(HEADER + data.length);
  out.set(NXBAK_MAGIC, 0);
  out[5] = 1;
  new DataView(out.buffer).setUint32(6, iterations, false);
  out.set(salt, 10);
  out.set(iv, 26);
  out.set(data, HEADER);
  return out;
}

export async function decryptPackage(bytes, passphrase) {
  if (!isNxbak(bytes)) throw new Error('Non è un pacchetto .nxbak');
  if (bytes[5] !== 1) throw new Error('Versione del pacchetto non supportata');
  const iterations = new DataView(bytes.buffer, bytes.byteOffset).getUint32(6, false);
  const key = await deriveKey(passphrase, bytes.slice(10, 26), iterations);
  try {
    return await decryptBytes(key, bytes.slice(26, 38), bytes.slice(HEADER));
  } catch {
    throw new Error('Passphrase errata o pacchetto danneggiato');
  }
}
