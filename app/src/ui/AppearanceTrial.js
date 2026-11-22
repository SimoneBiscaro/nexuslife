import { useEffect, useState } from '../../vendor/preact-hooks.mjs';
import { html } from './html.js';
import { signal, useSignal } from '../store/state.js';
import { updateSettings } from '../store/settings.js';
import { applyAppearance, appearanceLabel, PREVIEW_SECONDS, rememberAppearance, resolveAppearance } from './appearance.js';
import { haptic } from './haptics.js';
import { showToast } from './Toast.js';

/**
 * Prova di uno stile/tema su tutta l'app (CLAUDE.md §5): "Mantieni" lo salva nelle impostazioni
 * (e quindi lo sincronizza), "Torna indietro" o 15 secondi senza conferma ripristinano il precedente.
 */
export const trial = signal(null); // null | { style, theme, previous: { style, theme }, until: number }

/** Scelta salvata (aggiornata da main.js a ogni lettura delle impostazioni). */
export const savedAppearance = signal(resolveAppearance());

export function startTrial(style, theme) {
  const current = trial.value?.previous ?? savedAppearance.value;
  const r = applyAppearance(style, theme);
  if (r.style === current.style && r.theme === current.theme) { trial.value = null; return; }
  trial.value = { style: r.style, theme: r.theme, previous: { style: current.style, theme: current.theme }, until: Date.now() + PREVIEW_SECONDS * 1000 };
}

export function revertTrial() {
  const t = trial.value;
  if (!t) return;
  trial.value = null;
  applyAppearance(t.previous.style, t.previous.theme);
}

export async function keepTrial() {
  const t = trial.value;
  if (!t) return;
  trial.value = null;
  const r = resolveAppearance(t.style, t.theme);
  rememberAppearance(r);
  savedAppearance.value = r;
  haptic();
  try {
    await updateSettings({ appearanceStyle: r.style, appearanceTheme: r.theme });
    showToast({ message: `Aspetto: ${appearanceLabel(r.style, r.theme)}` });
  } catch (err) {
    console.warn('Aspetto non salvato:', err);
    showToast({ message: 'Aspetto applicato solo su questo dispositivo', status: 'warning' });
  }
}

/** Barra flottante con conto alla rovescia. Fuori da #app, così resta usabile anche con uno Sheet aperto. */
export function AppearanceTrialBar() {
  const t = useSignal(trial);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!t) return undefined;
    const id = setInterval(() => {
      if (Date.now() >= t.until) revertTrial();
      else setNow(Date.now());
    }, 250);
    return () => clearInterval(id);
  }, [t]);
  useEffect(() => {
    if (!t) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !document.documentElement.classList.contains('has-sheet')) revertTrial(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [t]);
  if (!t) return null;
  const left = Math.max(0, Math.ceil((t.until - now) / 1000));
  return html`
    <div class="trial-bar" role="region" aria-label="Prova dell'aspetto">
      <p class="trial-bar__text">
        <span>Stai provando <strong>${appearanceLabel(t.style, t.theme)}</strong></span>
        <span class="trial-bar__count" aria-hidden="true">${left === 1 ? 'torna indietro tra 1 secondo' : `torna indietro tra ${left} secondi`}</span>
        <span class="sr-only" role="status">${`Prova di ${appearanceLabel(t.style, t.theme)}: senza conferma torna indietro tra ${PREVIEW_SECONDS} secondi.`}</span>
      </p>
      <div class="trial-bar__actions">
        <button class="btn btn--secondary" type="button" onClick=${revertTrial}>Torna indietro</button>
        <button class="btn btn--primary" type="button" onClick=${keepTrial}>Mantieni</button>
      </div>
      <span class="trial-bar__timer" style=${`--pct:${(left / PREVIEW_SECONDS).toFixed(3)}`} aria-hidden="true"></span>
    </div>`;
}
