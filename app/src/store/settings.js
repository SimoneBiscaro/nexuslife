import { getRepo } from './repo.js';
import { DEFAULT_SETTINGS, SETTINGS_ID } from './seed.js';

/** Impostazioni correnti (con i valori predefiniti per i campi mancanti). */
export async function loadSettings() {
  const repo = await getRepo();
  const s = await repo.get('settings', SETTINGS_ID);
  return { ...DEFAULT_SETTINGS, ...(s || {}) };
}

/** Aggiorna le impostazioni, creando il record se manca. */
export async function updateSettings(patch) {
  const repo = await getRepo();
  const current = await repo.get('settings', SETTINGS_ID, { includeDeleted: true });
  if (!current) return repo.create('settings', { id: SETTINGS_ID, ...DEFAULT_SETTINGS, ...patch });
  return repo.update('settings', SETTINGS_ID, { ...patch, deleted: false });
}
