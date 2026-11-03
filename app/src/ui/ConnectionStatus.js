import { html } from './html.js';
import { online, useSignal } from '../store/state.js';
import { cloudConfigured, syncState } from '../store/cloud.js';

/** Puntino di stato connessione (verde online, grigio offline). */
export function ConnectionDot({ withLabel = false }) {
  const isOnline = useSignal(online);
  const label = isOnline ? 'Online' : 'Offline';
  return html`<span class=${withLabel ? 'sidebar__status' : ''} title=${label}>
    <span class="status-dot" data-status=${isOnline ? 'ok' : 'unknown'} role="img" aria-label=${`Connessione: ${label}`}></span>
    ${withLabel && html`<span aria-hidden="true">${label}</span>`}
  </span>`;
}

/**
 * Stato della sincronizzazione per l'indicatore: colore (data-status) ed etichetta.
 * @returns {{ status: string, label: string }}
 */
export function syncView(state, isOnline, configured = cloudConfigured) {
  if (!isOnline) return { status: 'unknown', label: 'Offline' };
  if (!configured || state.phase === 'off') return { status: 'unknown', label: 'Solo locale' };
  switch (state.phase) {
    case 'syncing': return { status: 'sync', label: 'Sincronizzazione in corso' };
    case 'ok': return { status: 'ok', label: 'Sincronizzato' };
    case 'idle': return { status: 'sync', label: 'In attesa di sincronizzare' };
    case 'offline': return { status: 'unknown', label: 'Offline' };
    case 'locked': return { status: 'warning', label: 'Passphrase richiesta' };
    case 'expired': return { status: 'warning', label: 'Accedi di nuovo' };
    case 'error': return { status: 'critical', label: 'Errore di sincronizzazione' };
    default: return { status: 'unknown', label: 'Solo locale' };
  }
}

/** Puntino di stato della sync (sincronizzato / in corso / offline / errore). */
export function SyncDot({ withLabel = false, class: cls = '' }) {
  const state = useSignal(syncState);
  const isOnline = useSignal(online);
  const { status, label } = syncView(state, isOnline);
  return html`<span class=${`${withLabel ? 'sidebar__status ' : ''}${cls}`} title=${label}>
    <span class="status-dot" data-status=${status} role="img" aria-label=${`Sincronizzazione: ${label}`}></span>
    ${withLabel && html`<span aria-hidden="true">${label}</span>`}
  </span>`;
}
