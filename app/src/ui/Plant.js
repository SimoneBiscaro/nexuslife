import { useId } from '../../vendor/preact-hooks.mjs';
import { html } from './html.js';

/*
 * Pianta del giardino zen, disegnata a mano in SVG (viewBox 120×150, terra a y=128).
 * La forma dipende solo dallo stadio (src/domain/garden.js) e da un seme per pianta,
 * così ogni categoria ha il suo portamento ma resta identica a ogni rendering.
 */

/** Tonalità delle foglie: [chiaro, scuro, fusto]. Dal mint delle piante sane al marrone delle secche. */
export const LEAF_TONES = {
  lush: ['#5BEBAE', '#1F9E6A', '#2FB57D'],
  green: ['#7BD9A4', '#2E8F62', '#3C9C6E'],
  yellow: ['#D6D66E', '#8E9A3A', '#8E9A4A'],
  amber: ['#FFC24D', '#B07414', '#9C7A3C'],
  brown: ['#A87A4C', '#5E3F22', '#6E5034'],
  neutral: ['#A9ACB2', '#5C5F66', '#6E7178'],
};

const GROUND = 128;
const BASE_X = 60;
const MAX_H = 104;

/** Generatore pseudo-casuale con seme (per variazioni stabili). */
function seeded(seed) {
  let s = 0;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

/** Punto sulla curva quadratica del fusto al parametro t ∈ [0, 1]. */
function stemPoint(t, top, ctrl) {
  const u = 1 - t;
  return {
    x: u * u * BASE_X + 2 * u * t * ctrl.x + t * t * top.x,
    y: u * u * GROUND + 2 * u * t * ctrl.y + t * t * top.y,
  };
}

const LEAF_PATH = 'M0 0C5-6.5 15-7.5 24-1.5C16 5 6 5.5 0 0Z';

function Leaf({ x, y, angle, scale, fill, vein }) {
  return html`<g transform=${`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(1)}) scale(${scale.toFixed(2)})`}>
    <path d=${LEAF_PATH} fill=${fill} />
    <path d="M1.5 0C8-1.4 15-2 22-1.4" class="plant__vein" stroke=${vein} />
  </g>`;
}

function Flower({ x, y, r, color, center, rot = 0 }) {
  const petals = [0, 72, 144, 216, 288];
  return html`<g class="plant__flower" transform=${`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot})`}>
    <circle r=${r * 1.9} style=${`fill:${color}`} opacity=".14" />
    ${petals.map((a) => html`<ellipse key=${a} cx="0" cy=${-r * 0.95} rx=${r * 0.62} ry=${r} style=${`fill:${color}`} transform=${`rotate(${a})`} />`)}
    <circle r=${r * 0.48} fill=${center} />
  </g>`;
}

function Bud({ x, y, angle, fill }) {
  return html`<g transform=${`translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(1)})`}>
    <path d="M0 0C-3.4-2.4-3.6-7.6 0-11C3.6-7.6 3.4-2.4 0 0Z" fill=${fill} />
  </g>`;
}

/**
 * @param {{ stage: object, seed?: string, flower?: string, size?: 'lg'|'sm', still?: boolean }} props
 *   `flower`: colore dei fiori (health o champagne). `still`: niente foglie in caduta (anteprime).
 */
export function Plant({ stage, seed = 'pianta', flower = 'var(--health)', size = 'lg', still = false }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const rand = seeded(seed);
  const [light, dark, stemColor] = LEAF_TONES[stage.tone] || LEAF_TONES.neutral;
  const sprout = stage.id === 'germoglio';
  const leafFill = `url(#pl-leaf-${uid})`;

  const h = MAX_H * stage.height;
  const lean = (rand() - 0.5) * 14 + stage.droop * (rand() > 0.5 ? 14 : -14);
  const top = { x: BASE_X + lean, y: GROUND - h + stage.droop * 10 };
  const ctrl = { x: BASE_X - lean * 0.35 + (rand() - 0.5) * 8, y: GROUND - h * 0.55 };
  const stemD = `M${BASE_X} ${GROUND}Q${ctrl.x.toFixed(1)} ${ctrl.y.toFixed(1)} ${top.x.toFixed(1)} ${top.y.toFixed(1)}`;

  // Foglie alternate lungo il fusto, più piccole verso la cima, più cadenti con la sofferenza.
  const leaves = [];
  const n = sprout ? 0 : stage.leaves;
  for (let i = 0; i < n; i++) {
    const t = 0.16 + (i / Math.max(1, n)) * 0.7;
    const p = stemPoint(t, top, ctrl);
    const side = i % 2 === 0 ? -1 : 1;
    const lift = 38 - stage.droop * 62 + (rand() - 0.5) * 12; // gradi sopra l'orizzontale
    const angle = side === 1 ? -lift : 180 + lift;
    const scale = (1.05 - t * 0.55) * (0.9 + rand() * 0.2) * (1 - stage.droop * 0.18);
    leaves.push({ x: p.x, y: p.y, angle, scale, key: i });
  }

  // Fiori: in cima e su due rametti laterali; i boccioli dove i fiori non ci sono.
  const tips = [
    { ...top, branch: null },
    { ...stemPoint(0.62, top, ctrl), branch: -1 },
    { ...stemPoint(0.78, top, ctrl), branch: 1 },
  ].map((p) => (p.branch ? { x: p.x + p.branch * 14, y: p.y - 9, from: { x: p.x, y: p.y } } : p));
  const flowers = sprout ? [] : tips.slice(0, stage.flowers);
  const buds = sprout ? [] : tips.slice(stage.flowers, stage.flowers + stage.buds);
  const branches = [...flowers, ...buds].filter((p) => p.from);

  // Foglie cadute sulla ghiaia, in posizioni stabili.
  const fallen = Array.from({ length: stage.fallen }, (_, i) => ({
    x: BASE_X + (i % 2 ? 1 : -1) * (12 + rand() * 26), y: GROUND + 1 + rand() * 7, angle: rand() * 360, key: i,
  }));
  const falling = still || stage.fallen === 0 ? [] : Array.from({ length: Math.min(2, stage.fallen) }, (_, i) => ({
    x: BASE_X + (i ? 10 : -12) + lean * 0.5, y: GROUND - h * (0.65 - i * 0.2), key: i,
  }));

  const sway = 1.6 - stage.droop * 0.9;
  return html`
    <svg class=${`plant plant--${size}`} viewBox="0 0 120 150" aria-hidden="true" focusable="false"
      style=${`--sway:${sway.toFixed(2)}deg;--sway-dur:${(7 + rand() * 3).toFixed(1)}s;--sway-delay:-${(rand() * 6).toFixed(1)}s`}>
      <defs>
        <linearGradient id=${`pl-leaf-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color=${light} /><stop offset="1" stop-color=${dark} />
        </linearGradient>
        <radialGradient id=${`pl-stone-${uid}`} cx=".35" cy=".3" r=".8">
          <stop offset="0" stop-color="#8E9196" /><stop offset=".55" stop-color="#5C5F66" /><stop offset="1" stop-color="#2A2C31" />
        </radialGradient>
        <radialGradient id=${`pl-glow-${uid}`} cx=".5" cy=".5" r=".5">
          <stop offset="0" stop-color="#D9BF8C" stop-opacity=".28" /><stop offset="1" stop-color="#D9BF8C" stop-opacity="0" />
        </radialGradient>
      </defs>

      ${stage.id === 'fiorita' && html`<ellipse class="plant__aura" cx=${top.x} cy=${top.y + 12} rx="46" ry="40" fill=${`url(#pl-glow-${uid})`} />`}

      <g class="plant__raked">
        <ellipse cx=${BASE_X} cy=${GROUND + 2} rx="50" ry="11" />
        <ellipse cx=${BASE_X} cy=${GROUND + 2} rx="38" ry="8" />
        <ellipse cx=${BASE_X} cy=${GROUND + 2} rx="26" ry="5.4" />
      </g>
      <ellipse cx=${BASE_X} cy=${GROUND + 1} rx="15" ry="3.6" class="plant__mound" />
      <g class="plant__stone">
        <ellipse cx="96" cy=${GROUND + 2} rx="11" ry="6.5" fill=${`url(#pl-stone-${uid})`} />
        <path d=${`M89 ${GROUND - 1}c3-3 8-4 12-2.5`} class="plant__stone-light" />
      </g>
      ${fallen.map((f) => html`<g key=${`f${f.key}`} transform=${`translate(${f.x.toFixed(1)} ${f.y.toFixed(1)}) rotate(${f.angle.toFixed(0)}) scale(.42)`}>
        <path d=${LEAF_PATH} fill=${LEAF_TONES.brown[0]} opacity=".85" /></g>`)}

      <g class="plant__body">
        ${sprout
          ? html`
            <path d=${`M${BASE_X} ${GROUND}C${BASE_X} ${GROUND - 12} ${BASE_X + 1} ${GROUND - 22} ${BASE_X} ${GROUND - 28}`} class="plant__stem" stroke=${stemColor} />
            <${Leaf} x=${BASE_X} y=${GROUND - 26} angle=${-38} scale=${0.62} fill=${leafFill} vein=${dark} />
            <${Leaf} x=${BASE_X} y=${GROUND - 26} angle=${218} scale=${0.56} fill=${leafFill} vein=${dark} />`
          : html`
            <path d=${stemD} class="plant__stem" stroke=${stemColor} />
            ${branches.map((b, i) => html`<path key=${`b${i}`} class="plant__stem plant__stem--thin" stroke=${stemColor}
              d=${`M${b.from.x.toFixed(1)} ${b.from.y.toFixed(1)}Q${((b.from.x + b.x) / 2).toFixed(1)} ${(b.from.y - 2).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`} />`)}
            ${leaves.map((l) => html`<${Leaf} key=${l.key} ...${l} fill=${leafFill} vein=${dark} />`)}
            ${buds.map((b, i) => html`<${Bud} key=${`u${i}`} x=${b.x} y=${b.y} angle=${stage.droop * 120 * (i % 2 ? 1 : -1)}
              fill=${stage.tone === 'brown' || stage.tone === 'amber' ? LEAF_TONES.brown[0] : light} />`)}
            ${flowers.map((f, i) => html`<${Flower} key=${`o${i}`} x=${f.x} y=${f.y} r=${i === 0 ? 7 : 5.2} rot=${i * 17}
              color=${flower} center="#F2E3C2" />`)}`}
      </g>

      ${falling.map((f) => html`<g key=${`d${f.key}`} class="plant__falling" style=${`--fall:${(GROUND - f.y).toFixed(0)}px;--fall-delay:${f.key * 4.5}s`}>
        <g transform=${`translate(${f.x.toFixed(1)} ${f.y.toFixed(1)}) scale(.45)`}><path d=${LEAF_PATH} fill=${LEAF_TONES.amber[0]} /></g>
      </g>`)}
    </svg>`;
}

/** Colore dei fiori per pianta: alternanza health / champagne. */
export function flowerColor(index) {
  return index % 2 === 0 ? 'var(--health)' : 'var(--champagne)';
}
