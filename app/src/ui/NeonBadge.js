import { html } from './html.js';
import { normalizeStatus } from './status.js';

/**
 * Pill con bordo luminoso. `overdue` pulsa sempre; `pulse` forza la pulsazione lenta.
 * Per la spesa: urgente → status "warning", urgente da più di 2 giorni → status "critical" + pulse.
 * @param {{ status?: string, pulse?: boolean, children?: any, label?: string }} props
 */
export function NeonBadge({ status = 'unknown', pulse = false, children, label }) {
  const st = normalizeStatus(status);
  const pulsing = pulse || st === 'overdue';
  return html`<span class=${`neon-badge${pulsing ? ' is-pulsing' : ''}`} data-status=${st} aria-label=${label}>
    <span class="neon-badge__dot" aria-hidden="true"></span>${children}
  </span>`;
}
