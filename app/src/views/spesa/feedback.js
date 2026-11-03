import { getRepo } from '../../store/repo.js';

/** Crea o aggiorna il feedback su un suggerimento (snooze o "non suggerire più"). */
export async function saveFeedback(feedback, normName, patch) {
  const repo = await getRepo();
  const existing = feedback.find((f) => f.normName === normName);
  if (existing) return repo.update('suggestionFeedback', existing.id, patch);
  return repo.create('suggestionFeedback', { normName, muted: false, snoozeUntil: null, ...patch });
}
