import { DEFAULT_CATEGORIES, itemsToAutoArchive } from '../domain/groceries.js';
import { toDateKey } from '../domain/dates.js';

export const SETTINGS_ID = 'settings';
export const DEFAULT_SETTINGS = {
  healthLockEnabled: true,
  reminderHour: 9,
  dismissedBanners: {},
  lastBackupAt: null,
};

const SEED_FLAG = 'seed.v1';

/**
 * Primo avvio: crea le 5 categorie spesa predefinite e il record settings.
 * Idempotente: un flag in meta impedisce di ricreare categorie che l'utente ha eliminato.
 * @returns {Promise<number>} numero di record creati
 */
export async function seedDefaults(repo) {
  if (await repo.getMeta(SEED_FLAG)) return 0;
  let created = 0;

  if (!(await repo.get('settings', SETTINGS_ID, { includeDeleted: true }))) {
    await repo.create('settings', { id: SETTINGS_ID, ...DEFAULT_SETTINGS });
    created++;
  }

  const existing = new Set((await repo.list('groceryCategory')).map((c) => c.normName));
  const missing = DEFAULT_CATEGORIES.filter((c) => !existing.has(c.normName));
  if (missing.length) {
    await repo.batch(missing.map((c) => ({ entity: 'groceryCategory', create: { ...c } })));
    created += missing.length;
  }

  await repo.setMeta(SEED_FLAG, repo.now());
  return created;
}

/**
 * Manutenzione all'avvio: elimina le tombstone scadute e archivia gli articoli
 * spuntati da più di 6 ore registrandoli come acquisti.
 */
export async function startupMaintenance(repo, now = new Date()) {
  const purged = await repo.purgeTombstones();
  const stale = itemsToAutoArchive(await repo.list('groceryItem'), now);
  if (stale.length) {
    await repo.batch([
      ...stale.map((i) => ({
        entity: 'groceryPurchase',
        create: { normName: i.normName, name: i.name, date: toDateKey(i.checkedAt), categoryId: i.categoryId },
      })),
      ...stale.map((i) => ({ entity: 'groceryItem', id: i.id, patch: { archived: true } })),
    ]);
  }
  return { purged, archived: stale.length };
}
