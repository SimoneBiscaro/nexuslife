import { useEffect, useState } from '../../vendor/preact-hooks.mjs';
import { html } from './html.js';
import { STATUS_LABEL, normalizeStatus } from './status.js';

const R = 42;
const C = 2 * Math.PI * R;
const SWEEP = 0.75; // 270°
const ARC = C * SWEEP;
const START_DEG = 135; // l'apertura dell'anello resta in basso
const TICKS = 27;

function polar(deg, radius) {
  const rad = (deg * Math.PI) / 180;
  return [50 + radius * Math.cos(rad), 50 + radius * Math.sin(rad)];
}

const TICK_PATH = Array.from({ length: TICKS + 1 }, (_, i) => {
  const deg = START_DEG + (270 * i) / TICKS;
  const major = i % 9 === 0;
  const [x1, y1] = polar(deg, major ? 31 : 33);
  const [x2, y2] = polar(deg, 35.5);
  return `M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}`;
}).join('');

/**
 * Anello HUD a 270° che si svuota con il tempo.
 * @param {{ value: string|number, label: string, ratio: number, status: string, unit?: string, sublabel?: string, size?: number }} props
 * `ratio` = porzione di periodo rimanente (1 = pieno, 0 = vuoto).
 */
export function HudGauge({ value, label, ratio = 0, status = 'unknown', unit = '', sublabel = '', size = 148 }) {
  const st = normalizeStatus(status);
  const target = st === 'unknown' ? 0 : Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const [shown, setShown] = useState(0);

  useEffect(() => {
    // parte da vuoto e si riempie al valore: l'anello "si accende" all'ingresso
    const id = requestAnimationFrame(() => setShown(target));
    return () => cancelAnimationFrame(id);
  }, [target]);

  const displayValue = st === 'unknown' || value === null || value === undefined || value === '' ? '—' : value;
  const tipDeg = START_DEG + 270 * shown;
  const [tx, ty] = polar(tipDeg, R);
  const aria = `${label}: ${displayValue}${unit ? ` ${unit}` : ''}, ${STATUS_LABEL[st]}${sublabel ? `, ${sublabel}` : ''}`;

  return html`
    <div class="hud-gauge" data-status=${st} style=${`--size:${size}px`} role="img" aria-label=${aria}>
      <div class="hud-gauge__ring">
        <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
          <path class="hud-gauge__ticks" d=${TICK_PATH} />
          <circle class="hud-gauge__track" cx="50" cy="50" r=${R}
            style=${`stroke-dasharray:${ARC.toFixed(2)} ${C.toFixed(2)}`} transform=${`rotate(${START_DEG} 50 50)`} />
          <circle class="hud-gauge__arc" cx="50" cy="50" r=${R}
            style=${`stroke-dasharray:${(ARC * shown).toFixed(2)} ${C.toFixed(2)}`} transform=${`rotate(${START_DEG} 50 50)`}
            opacity=${shown > 0.001 ? 1 : 0} />
          <circle class="hud-gauge__tip" cx=${tx.toFixed(2)} cy=${ty.toFixed(2)} r="2.2" opacity=${shown > 0.001 ? 1 : 0} />
        </svg>
        <div class="hud-gauge__center" aria-hidden="true">
          <span class="hud-gauge__value">${displayValue}</span>
          ${unit && html`<span class="hud-gauge__unit">${unit}</span>`}
        </div>
      </div>
      <div class="hud-gauge__label" aria-hidden="true">${label}</div>
      ${sublabel && html`<div class="hud-gauge__sub" aria-hidden="true">${sublabel}</div>`}
    </div>`;
}
