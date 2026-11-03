import { html } from './html.js';
import { daysBetween } from '../domain/dates.js';
import { formatInt, formatShortDate } from './format.js';

/**
 * Grafico a linea semplice (date → valori), in SVG.
 * @param {{ points: Array<{ date: string, value: number }>, label: string, unit?: string }} props
 */
export function LineChart({ points, label, unit = '' }) {
  const W = 320;
  const H = 140;
  const P = { l: 8, r: 8, t: 14, b: 22 };
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : 1));
  if (sorted.length < 2) {
    return html`<p class="card-text">Servono almeno due letture per disegnare l'andamento.</p>`;
  }
  const first = sorted[0].date;
  const span = Math.max(1, daysBetween(first, sorted[sorted.length - 1].date));
  const values = sorted.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const x = (d) => P.l + (daysBetween(first, d) / span) * (W - P.l - P.r);
  const y = (v) => P.t + (1 - (v - min) / range) * (H - P.t - P.b);
  const line = sorted.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)} ${y(p.value).toFixed(1)}`).join('');
  const area = `${line}L${x(sorted[sorted.length - 1].date).toFixed(1)} ${H - P.b}L${P.l} ${H - P.b}Z`;
  const last = sorted[sorted.length - 1];
  const summary = `${label}: da ${formatInt(min)} a ${formatInt(max)} ${unit} tra ${formatShortDate(first)} e ${formatShortDate(last.date)}`;

  return html`
    <figure class="line-chart">
      <svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${summary}>
        <defs>
          <linearGradient id="lc-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="var(--electric-blue)" stop-opacity=".35" />
            <stop offset="1" stop-color="var(--electric-blue)" stop-opacity="0" />
          </linearGradient>
        </defs>
        ${[0, 0.5, 1].map((t) => html`<line class="line-chart__grid" key=${t} x1=${P.l} x2=${W - P.r}
          y1=${P.t + t * (H - P.t - P.b)} y2=${P.t + t * (H - P.t - P.b)} />`)}
        <path class="line-chart__area" d=${area} fill="url(#lc-fill)" />
        <path class="line-chart__line" d=${line} />
        ${sorted.map((p) => html`<circle class="line-chart__dot" key=${p.date} cx=${x(p.date)} cy=${y(p.value)} r="3" />`)}
      </svg>
      <figcaption class="line-chart__axis" aria-hidden="true">
        <span>${formatShortDate(first)}</span>
        <span>${formatInt(min)} → ${formatInt(max)} ${unit}</span>
        <span>${formatShortDate(last.date)}</span>
      </figcaption>
    </figure>`;
}
