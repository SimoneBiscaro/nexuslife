import { closeRepo, getRepo } from './repo.js';
import { loadSettings, updateSettings } from './settings.js';
import { ensureRentInstallments } from './home.js';
import { DB_NAME } from './db.js';
import { APP_VERSION } from '../version.js';
import { toDateKey } from '../domain/dates.js';
import { backupFilename, createBackupPackage, encryptPackage } from '../backup/package.js';
import { planMerge, planReplace, readBackup } from '../backup/restore.js';
import { saveFile } from '../ui/download.js';

/**
 * "Scarica pacchetto di oggi".
 * @returns {Promise<{ result: string, filename: string, size: number, records: number }>}
 */
export async function downloadBackup({ excludeHealth = false, passphrase = '' } = {}) {
  const repo = await getRepo();
  const now = new Date();
  const today = toDateKey(now);
  const pkg = await createBackupPackage(await repo.listAll(), { today, now, appVersion: APP_VERSION, excludeHealth });
  const encrypted = Boolean(passphrase);
  const bytes = encrypted ? await encryptPackage(pkg.bytes, passphrase) : pkg.bytes;
  const filename = backupFilename(today, encrypted);
  const blob = new Blob([bytes], { type: encrypted ? 'application/octet-stream' : 'application/zip' });
  const result = await saveFile(blob, filename);
  if (result !== 'cancelled') {
    const settings = await loadSettings();
    const entry = { at: now.toISOString(), filename, size: bytes.length, records: pkg.recordCount, encrypted, excludeHealth };
    await updateSettings({ lastBackupAt: entry.at, backupHistory: [entry, ...(settings.backupHistory || [])].slice(0, 10) });
  }
  return { result, filename, size: bytes.length, records: pkg.recordCount };
}

/** Legge e verifica un file scelto dall'utente. */
export async function inspectBackup(file, passphrase) {
  return readBackup(new Uint8Array(await file.arrayBuffer()), { passphrase });
}

/**
 * Applica il ripristino.
 * @param {'merge'|'replace'} mode
 * @returns {Promise<number>} record scritti
 */
export async function applyRestore(backup, mode) {
  const repo = await getRepo();
  const local = await repo.listAll();
  const now = repo.now();
  const changes = mode === 'replace' ? planReplace(local, backup.records, now) : planMerge(local, backup.records, now);
  await repo.saveAll(changes);
  await ensureRentInstallments(repo, toDateKey(new Date()));
  return changes.length;
}

/** Cancella il database locale e le preferenze del browser, poi ricarica l'app. */
export async function clearAllLocalData() {
  await closeRepo();
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* archivio del browser non disponibile */ }
  await new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve(); // altre schede aperte: verrà completato alla loro chiusura
  });
  location.reload();
}
