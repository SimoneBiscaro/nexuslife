import { html } from './html.js';
import { signal, useSignal } from '../store/state.js';
import { normalizeStatus } from './status.js';

const LEAVE_MS = 220;
const toasts = signal([]);
let seq = 0;
const timers = new Map();

function remove(id) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  toasts.value = toasts.value.map((t) => (t.id === id ? { ...t, leaving: true } : t));
  setTimeout(() => { toasts.value = toasts.value.filter((t) => t.id !== id); }, LEAVE_MS);
}

/**
 * Mostra un toast. Con `onAction` compare il pulsante (predefinito "Annulla").
 * `duration` in ms; `Infinity` resta finché non si agisce.
 * @returns {() => void} funzione che chiude il toast
 */
export function showToast({ message, actionLabel = 'Annulla', onAction, duration = 5000, status = 'ok' }) {
  const id = ++seq;
  toasts.value = [...toasts.value.slice(-2), { id, message, actionLabel, onAction, duration, status: normalizeStatus(status) }];
  if (Number.isFinite(duration)) timers.set(id, setTimeout(() => remove(id), duration));
  return () => remove(id);
}

export function ToastHost() {
  const list = useSignal(toasts);
  return html`
    <div class="toast-host" role="status" aria-live="polite" aria-atomic="false">
      ${list.map((t) => html`
        <div class=${`toast${t.leaving ? ' is-leaving' : ''}`} key=${t.id} data-status=${t.status}>
          <span class="toast__dot" aria-hidden="true"></span>
          <span class="toast__msg">${t.message}</span>
          ${t.onAction && html`<button class="btn btn--ghost" type="button" onClick=${() => { remove(t.id); t.onAction(); }}>${t.actionLabel}</button>`}
          ${Number.isFinite(t.duration) && html`<span class="toast__timer" style=${`animation-duration:${t.duration}ms`} aria-hidden="true"></span>`}
        </div>`)}
    </div>`;
}
