import { html } from './html.js';
import { formatEuro } from './format.js';

const MONTHS = ['G', 'F', 'M', 'A', 'M', 'G', 'L', 'A', 'S', 'O', 'N', 'D'];
const MONTH_NAMES = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];

/**
 * Barre mensili impilate per serie.
 * @param {{ series: Array<{ key: string, label: string, color: string, values: number[] }>, label: string, highlight?: number }} props
 */
export function BarChart({ series, label, highlight }) {
  const W = 320;
  const H = 120;
  const P = { t: 8, b: 18 };
  const totals = MONTHS.map((_, m) => series.reduce((s, x) => s + x.values[m], 0));
  const max = Math.max(1, ...totals);
  const slot = W / 12;
  const bw = slot * 0.56;
  const scale = (v) => (v / max) * (H - P.t - P.b);
  const summary = `${label}: ${totals.map((t, m) => (t ? `${MONTH_NAMES[m]} ${formatEuro(t)}` : null)).filter(Boolean).join(', ') || 'nessuna spesa'}`;

  return html`
    <figure class="bar-chart">
      <svg viewBox=${`0 0 ${W} ${H}`} role="img" aria-label=${summary}>
        ${MONTHS.map((m, i) => {
          let y = H - P.b;
          const x = i * slot + (slot - bw) / 2;
          return html`<g key=${i}>
            <rect class="bar-chart__track" x=${x} y=${P.t} width=${bw} height=${H - P.t - P.b} rx="3" />
            ${series.map((s) => {
              const h = scale(s.values[i]);
              if (h <= 0) return null;
              y -= h;
              return html`<rect key=${s.key} x=${x} y=${y} width=${bw} height=${h} rx="2" fill=${s.color} />`;
            })}
            <text class=${`bar-chart__label${i === highlight ? ' is-on' : ''}`} x=${x + bw / 2} y=${H - 4} text-anchor="middle">${m}</text>
          </g>`;
        })}
      </svg>
    </figure>`;
}
