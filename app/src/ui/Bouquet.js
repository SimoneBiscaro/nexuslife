import { useId } from '../../vendor/preact-hooks.mjs';
import { html } from './html.js';

/*
 * Giardino zen come mazzo: uno stelo per categoria in un vaso di vetro su ghiaia rastrellata.
 * Il colore del fiore identifica la categoria; lo stadio (src/domain/garden.js) decide altezza,
 * piegatura, foglie, apertura del fiore e petali caduti. viewBox 400×340, terra a y=318.
 */

/** Colore del fiore per categoria (lo stesso nella legenda). */
export const PLANT_COLORS = {
  auto: '#6FA8FF',
  affitto: '#D9BF8C',
  manutenzioni: '#B79CFF',
  spesa: '#FFB020',
  salute: '#FF6B8B',
  todo: '#3FD2C7',
  backup: '#E6E4EE',
};

/** Tonalità delle foglie: [chiaro, scuro, stelo]. */
const TONES = {
  lush: ['#5BEBAE', '#1F9E6A', '#2FB57D'],
  green: ['#7BD9A4', '#2E8F62', '#3C9C6E'],
  yellow: ['#D6D66E', '#8E9A3A', '#8E9A4A'],
  amber: ['#FFC24D', '#B07414', '#9C7A3C'],
  brown: ['#A87A4C', '#5E3F22', '#6E5034'],
  neutral: ['#A9ACB2', '#5C5F66', '#6E7178'],
};

const CX = 200;
const NECK_Y = 214;
const GROUND = 318;
const MAX_LEN = 150;
const LEAF = 'M0 0C5-6.5 15-7.5 24-1.5C16 5 6 5.5 0 0Z';
const rad = (deg) => (deg * Math.PI) / 180;
const f1 = (n) => n.toFixed(1);

/** Variazione stabile per categoria (stessa forma a ogni rendering). */
function jitter(seed, k) {
  let s = k * 7919;
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  s = (s * 1664525 + 1013904223) >>> 0;
  return s / 2 ** 32 - 0.5;
}

/** Geometria di uno stelo: base nell'acqua, passaggio dal collo, curva verso la punta. */
function stemGeometry(plant, i, n) {
  const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1; // −1 … 1 da sinistra a destra
  const stage = plant.stage;
  const side = t < 0 ? -1 : t > 0 ? 1 : (jitter(plant.id, 1) < 0 ? -1 : 1);
  const angle = t * 50 + jitter(plant.id, 2) * 6;
  const bend = angle + side * stage.droop * 70;
  const len = MAX_LEN * stage.height * (1 - 0.12 * Math.abs(t)) * (1 + jitter(plant.id, 3) * 0.08);
  const base = { x: CX + t * 10, y: 278 };
  const neck = { x: CX + t * 22, y: NECK_Y };
  const ctrl = { x: neck.x + Math.sin(rad(angle)) * len * 0.62, y: neck.y - Math.cos(rad(angle)) * len * 0.62 };
  const tip = { x: ctrl.x + Math.sin(rad(bend)) * len * 0.45, y: ctrl.y - Math.cos(rad(bend)) * len * 0.45 };
  return { t, side, angle, bend, len, base, neck, ctrl, tip };
}

/** Punto e direzione (gradi) sulla curva quadratica collo → punta. */
function along(g, s) {
  const u = 1 - s;
  const x = u * u * g.neck.x + 2 * u * s * g.ctrl.x + s * s * g.tip.x;
  const y = u * u * g.neck.y + 2 * u * s * g.ctrl.y + s * s * g.tip.y;
  const dx = 2 * u * (g.ctrl.x - g.neck.x) + 2 * s * (g.tip.x - g.ctrl.x);
  const dy = 2 * u * (g.ctrl.y - g.neck.y) + 2 * s * (g.tip.y - g.ctrl.y);
  return { x, y, dir: (Math.atan2(dx, -dy) * 180) / Math.PI };
}

/** Testa del fiore secondo lo stadio, orientata lungo lo stelo. */
function Head({ stage, color, at, uid }) {
  const rot = f1(at.dir);
  const pos = `translate(${f1(at.x)} ${f1(at.y)}) rotate(${rot})`;
  switch (stage.id) {
    case 'fiorita':
    case 'sana': {
      const n = stage.id === 'fiorita' ? 8 : 6;
      const r = stage.id === 'fiorita' ? 13 : 11;
      return html`<g transform=${pos} class="bq__head">
        ${stage.id === 'fiorita' && html`<circle r=${r * 2.2} fill=${`url(#bq-glow-${uid})`} style=${`color:${color}`} />`}
        ${Array.from({ length: n }, (_, k) => html`<ellipse key=${k} cx="0" cy=${-r * 0.9} rx=${r * 0.5} ry=${r}
          style=${`fill:${color}`} transform=${`rotate(${(360 / n) * k})`} />`)}
        <circle r=${r * 0.42} fill="#F2E3C2" />
        <circle r=${r * 0.42} fill="none" stroke="rgba(0,0,0,.18)" />
      </g>`;
    }
    case 'assetata':
      // fiore socchiuso a coppa
      return html`<g transform=${pos} class="bq__head">
        <path d="M0 2C-9 0-11-9-7-16C-4-11-2-9 0-9Z" style=${`fill:${color}`} opacity=".9" />
        <path d="M0 2C9 0 11-9 7-16C4-11 2-9 0-9Z" style=${`fill:${color}`} opacity=".9" />
        <path d="M0 2C-4-2-4-12 0-19C4-12 4-2 0 2Z" style=${`fill:${color}`} />
      </g>`;
    case 'appassita':
      // testa reclinata con pochi petali spenti
      return html`<g transform=${`${pos} rotate(${45 * (at.dir < 0 ? -1 : 1)})`} class="bq__head">
        ${[-50, -10, 30].map((a) => html`<ellipse key=${a} cx="0" cy="-8" rx="4.5" ry="9" style=${`fill:${color}`} opacity=".55"
          transform=${`rotate(${a})`} />`)}
        <circle r="4" fill="#9C7A3C" />
      </g>`;
    case 'secca':
      return html`<g transform=${pos} class="bq__head">
        <circle r="4.5" fill="#6E5034" />
        <path d="M-2-4l-3-6M2-4l3-6M0-4v-7" stroke="#8a6a46" stroke-width="1.2" stroke-linecap="round" />
      </g>`;
    default:
      // germoglio: bocciolo chiuso grigio
      return html`<g transform=${pos} class="bq__head">
        <path d="M0 2C-5-1-5-9 0-15C5-9 5-1 0 2Z" fill="#8E9196" />
        <path d="M0 2C-2-3-2-9 0-13" stroke="#C7CAD1" stroke-width=".8" fill="none" opacity=".6" />
      </g>`;
  }
}

function Stem({ plant, g, color, uid, onSelect, active, still }) {
  const stage = plant.stage;
  const [light, dark, stemColor] = TONES[stage.tone] || TONES.neutral;
  const leafCount = stage.id === 'germoglio' ? 1 : Math.max(1, Math.round(stage.leaves / 3));
  const leaves = Array.from({ length: leafCount }, (_, k) => {
    const s = 0.22 + k * (0.5 / Math.max(1, leafCount));
    const p = along(g, s);
    const out = k % 2 === 0 ? g.side : -g.side;
    const lift = 48 - stage.droop * 70;
    return { ...p, angle: p.dir - 90 + out * (90 - lift) + (out < 0 ? 180 : 0), flip: out < 0, k };
  });
  const head = along(g, 1);
  const falling = still || stage.fallen === 0 ? null : { x: head.x, y: head.y, fall: GROUND - head.y };
  const sway = (1.6 - stage.droop) * (g.side || 1);
  const dim = active && active !== plant.id;
  return html`
    <g class=${`bq__stem${dim ? ' is-dim' : ''}${active === plant.id ? ' is-active' : ''}`} data-id=${plant.id}
      onClick=${onSelect ? () => onSelect(plant.id) : undefined}
      style=${`transform-origin:${f1(g.neck.x)}px ${NECK_Y}px;--sway:${f1(sway)}deg;--sway-dur:${(7 + (jitter(plant.id, 4) + 0.5) * 3).toFixed(1)}s;--sway-delay:-${((jitter(plant.id, 5) + 0.5) * 6).toFixed(1)}s`}>
      <path class="bq__stalk" stroke=${stemColor}
        d=${`M${f1(g.base.x)} ${g.base.y}L${f1(g.neck.x)} ${g.neck.y}Q${f1(g.ctrl.x)} ${f1(g.ctrl.y)} ${f1(g.tip.x)} ${f1(g.tip.y)}`} />
      ${leaves.map((l) => html`<g key=${l.k} transform=${`translate(${f1(l.x)} ${f1(l.y)}) rotate(${f1(l.angle)}) scale(${l.flip ? '.78 -.78' : '.78'})`}>
        <path d=${LEAF} fill=${`url(#bq-leaf-${uid}-${stage.tone})`} />
        <path d="M1.5 0C8-1.4 15-2 22-1.4" class="bq__vein" stroke=${dark} />
      </g>`)}
      <${Head} stage=${stage} color=${color} at=${head} uid=${uid} />
      <title>${plant.summary}</title>
      ${falling && html`<g class="bq__falling" style=${`--fall:${f1(falling.fall)}px;--fall-delay:${f1((jitter(plant.id, 6) + 0.5) * 8)}s`}>
        <ellipse cx=${f1(falling.x)} cy=${f1(falling.y)} rx="3" ry="5.5" style=${`fill:${color}`} opacity=".8" />
      </g>`}
      <path d=${`M${f1(g.neck.x)} ${g.neck.y}Q${f1(g.ctrl.x)} ${f1(g.ctrl.y)} ${f1(g.tip.x)} ${f1(g.tip.y)}`} class="bq__hit" />
      <circle cx=${f1(head.x)} cy=${f1(head.y)} r="18" class="bq__hit" />
    </g>`;
}

/**
 * @param {{ plants: Array<{ id: string, stage: object, summary?: string }>, onSelect?: (id: string) => void,
 *   active?: string|null, size?: 'lg'|'sm', still?: boolean }} props
 *   `still`: niente petali in caduta (anteprime). L'SVG è decorativo: la legenda è il controllo accessibile.
 */
export function Bouquet({ plants, onSelect, active = null, size = 'lg', still = false }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const n = plants.length;
  const geoms = plants.map((p, i) => stemGeometry(p, i, n));
  const tones = [...new Set(plants.map((p) => p.stage.tone))];
  // petali caduti sulla ghiaia, nel colore della categoria
  const fallen = plants.flatMap((p, i) => Array.from({ length: Math.min(4, p.stage.fallen) }, (_, k) => ({
    key: `${p.id}${k}`, color: PLANT_COLORS[p.id] || '#C7CAD1',
    x: CX + (geoms[i].t || jitter(p.id, 7)) * 70 + jitter(p.id, 10 + k) * 60 + (k % 2 ? 1 : -1) * 18,
    y: GROUND - 2 + (jitter(p.id, 20 + k) + 0.5) * 12, rot: (jitter(p.id, 30 + k) + 0.5) * 360,
  })));

  return html`
    <svg class=${`bouquet bouquet--${size}`} viewBox="0 0 400 340" aria-hidden="true" focusable="false">
      <defs>
        ${tones.map((tone) => html`<linearGradient key=${tone} id=${`bq-leaf-${uid}-${tone}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color=${(TONES[tone] || TONES.neutral)[0]} /><stop offset="1" stop-color=${(TONES[tone] || TONES.neutral)[1]} />
        </linearGradient>`)}
        <radialGradient id=${`bq-glow-${uid}`}><stop offset="0" stop-color="currentColor" stop-opacity=".35" /><stop offset="1" stop-color="currentColor" stop-opacity="0" /></radialGradient>
        <radialGradient id=${`bq-light-${uid}`} cx=".5" cy=".4" r=".5">
          <stop offset="0" stop-color="#F2E3C2" stop-opacity=".16" /><stop offset="1" stop-color="#F2E3C2" stop-opacity="0" />
        </radialGradient>
        <linearGradient id=${`bq-glass-${uid}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#fff" stop-opacity=".16" /><stop offset=".35" stop-color="#fff" stop-opacity=".05" />
          <stop offset=".75" stop-color="#fff" stop-opacity=".03" /><stop offset="1" stop-color="#fff" stop-opacity=".12" />
        </linearGradient>
        <radialGradient id=${`bq-stone-${uid}`} cx=".35" cy=".3" r=".8">
          <stop offset="0" stop-color="#8E9196" /><stop offset=".55" stop-color="#5C5F66" /><stop offset="1" stop-color="#2A2C31" />
        </radialGradient>
        <clipPath id=${`bq-water-${uid}`}><rect x="140" y="246" width="120" height="70" /></clipPath>
      </defs>

      <ellipse class="bq__light" cx=${CX} cy="120" rx="190" ry="130" fill=${`url(#bq-light-${uid})`} />
      <g class="bq__raked">
        ${[150, 122, 94, 68].map((rx, k) => html`<ellipse key=${rx} cx=${CX} cy=${GROUND + 2} rx=${rx} ry=${13 - k * 2} />`)}
      </g>
      <ellipse cx=${CX} cy=${GROUND - 4} rx="56" ry="7" fill="rgba(0,0,0,.55)" />
      <g class="bq__stones">
        <ellipse cx="300" cy=${GROUND - 1} rx="20" ry="10" fill=${`url(#bq-stone-${uid})`} />
        <ellipse cx="96" cy=${GROUND + 2} rx="13" ry="7" fill=${`url(#bq-stone-${uid})`} />
        <path d=${`M287 ${GROUND - 6}c5-4 13-5 19-3`} class="bq__stone-light" />
      </g>
      ${fallen.map((p) => html`<ellipse key=${p.key} cx=${f1(p.x)} cy=${f1(p.y)} rx="3" ry="5.5" style=${`fill:${p.color}`} opacity=".55"
        transform=${`rotate(${f1(p.rot)} ${f1(p.x)} ${f1(p.y)})`} />`)}

      ${plants.map((p, i) => html`<${Stem} key=${p.id} plant=${p} g=${geoms[i]} color=${PLANT_COLORS[p.id] || '#C7CAD1'}
        uid=${uid} onSelect=${onSelect} active=${active} still=${still} />`)}

      <g class="bq__vase">
        <path d="M168 214C166 240 150 252 152 280C154 304 172 312 200 312C228 312 246 304 248 280C250 252 234 240 232 214Z"
          fill=${`url(#bq-glass-${uid})`} />
        <path d="M168 214C166 240 150 252 152 280C154 304 172 312 200 312C228 312 246 304 248 280C250 252 234 240 232 214Z"
          clip-path=${`url(#bq-water-${uid})`} fill="rgba(111,168,255,.10)" />
        <path d="M153 247C175 251 225 251 247 247" class="bq__waterline" />
        <path d="M168 214C166 240 150 252 152 280C154 304 172 312 200 312C228 312 246 304 248 280C250 252 234 240 232 214" class="bq__glass-edge" />
        <ellipse cx=${CX} cy=${NECK_Y} rx="32" ry="5" class="bq__rim" />
        <path d="M164 258C160 272 162 290 170 300" class="bq__shine" />
        <path d="M172 226h56" class="bq__ribbon" />
      </g>
    </svg>`;
}
