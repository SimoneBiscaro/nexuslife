import { html } from './html.js';
import { online, useSignal } from '../store/state.js';

/** Puntino di stato connessione (verde online, grigio offline). */
export function ConnectionDot({ withLabel = false }) {
  const isOnline = useSignal(online);
  const label = isOnline ? 'Online' : 'Offline';
  return html`<span class=${withLabel ? 'sidebar__status' : ''} title=${label}>
    <span class="status-dot" data-status=${isOnline ? 'ok' : 'unknown'} role="img" aria-label=${`Connessione: ${label}`}></span>
    ${withLabel && html`<span aria-hidden="true">${label}</span>`}
  </span>`;
}
