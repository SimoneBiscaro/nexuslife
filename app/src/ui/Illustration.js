import { useId } from '../../vendor/preact-hooks.mjs';
import { html } from './html.js';

/*
 * Illustrazioni degli stati vuoti, disegnate a mano in SVG (160×120).
 * Tratto nel colore d'accento della sezione (currentColor), riempimenti a gradiente tenue,
 * un alone a terra e qualche scintilla champagne. Nessuna immagine esterna.
 */

const sparkle = (x, y, r = 4) => html`<path class="ill__spark" d=${`M${x} ${y - r}C${x + r * 0.15} ${y - r * 0.15} ${x + r * 0.15} ${y - r * 0.15} ${x + r} ${y}C${x + r * 0.15} ${y + r * 0.15} ${x + r * 0.15} ${y + r * 0.15} ${x} ${y + r}C${x - r * 0.15} ${y + r * 0.15} ${x - r * 0.15} ${y + r * 0.15} ${x - r} ${y}C${x - r * 0.15} ${y - r * 0.15} ${x - r * 0.15} ${y - r * 0.15} ${x} ${y - r}Z`} />`;

/** Ogni scena riceve `f` (id del gradiente di riempimento) e restituisce i tracciati. */
const SCENES = {
  // Oggi: calendario con spunta, sole che sorge
  oggi: (f) => html`
    <path class="ill__soft" d="M30 34a18 18 0 0 1 36 0" /><path class="ill__soft" d="M48 8v6M30 16l4 4M66 16l-4 4M22 34h4M70 34h4" />
    <rect x="50" y="30" width="62" height="58" rx="10" fill=${`url(#${f})`} />
    <path d="M50 46h62" /><path d="M64 24v12M98 24v12" />
    <path class="ill__soft" d="M62 58h6M76 58h6M90 58h6M62 70h6M76 70h6" />
    <circle cx="108" cy="80" r="17" class="ill__disc" /><path d="M100 80l5.5 5.5L117 74" class="ill__bold" />
    ${sparkle(128, 40)}${sparkle(40, 74, 3)}`,

  // Spesa: cesto con baguette, bottiglia e foglia
  spesa: (f) => html`
    <path class="ill__soft" d="M88 44l8-26 6 2-6 26" /><path d="M66 46c-2-12 2-22 10-26 2 10-2 20-10 26Z" class="ill__leaf" />
    <path d="M58 46V28a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v18" fill=${`url(#${f})`} /><path class="ill__soft" d="M60 20h8" />
    <path d="M44 48a36 26 0 0 1 72 0" />
    <path d="M36 48h88l-9 38a6 6 0 0 1-6 5H51a6 6 0 0 1-6-5Z" fill=${`url(#${f})`} />
    <path class="ill__soft" d="M58 58l3 24M80 58v24M102 58l-3 24M42 68h76" />
    ${sparkle(128, 26)}${sparkle(32, 30, 3)}`,

  // Bollette: ricevuta con fulmine e euro
  bollette: (f) => html`
    <path d="M56 14h48v84l-6-4-6 4-6-4-6 4-6-4-6 4-6-4-6 4Z" fill=${`url(#${f})`} />
    <path class="ill__soft" d="M66 30h28M66 40h20M66 50h24" />
    <circle cx="104" cy="74" r="16" class="ill__disc" /><path d="M106 64l-7 11h8l-6 10" class="ill__bold" />
    <path class="ill__soft" d="M70 66a8 8 0 1 0 0 12M64 70h8M64 74h8" />
    ${sparkle(126, 30)}${sparkle(40, 60, 3)}`,

  // Manutenzioni: ingranaggio e chiave inglese
  manutenzioni: (f) => html`
    <path d="M70 26l4-8h8l4 8 8 3 8-4 6 6-4 8 3 8 8 4v8l-8 4-3 8 4 8-6 6-8-4-8 3-4 8h-8l-4-8-8-3-8 4-6-6 4-8-3-8-8-4v-8l8-4 3-8-4-8 6-6 8 4Z" fill=${`url(#${f})`} />
    <circle cx="78" cy="62" r="12" class="ill__soft" />
    <path d="M110 92l18 18M104 98a14 14 0 0 1-2-18l8 8 8-2 2-8-8-8a14 14 0 0 1 18 2 14 14 0 0 1 2 16" class="ill__bold" />
    ${sparkle(130, 24)}${sparkle(34, 98, 3)}`,

  // Da comprare per la casa: scatola aperta e lampada
  acquisti: (f) => html`
    <path class="ill__soft" d="M80 8v12" /><path d="M66 36a14 14 0 0 1 28 0Z" fill=${`url(#${f})`} /><path class="ill__soft" d="M74 42a6 6 0 0 0 12 0" />
    <path d="M44 62l36-12 36 12-36 12Z" />
    <path d="M44 62v28l36 12 36-12V62" fill=${`url(#${f})`} /><path d="M80 74v28" />
    <path d="M44 62l-10 12 36 12 10-12M116 62l10 12-36 12" class="ill__soft" />
    ${sparkle(124, 32)}${sparkle(38, 40, 3)}`,

  // Spese auto: vista laterale e monete
  auto: (f) => html`
    <path d="M24 78v-12l10-16a8 8 0 0 1 7-4h40a10 10 0 0 1 7 3l15 15 13 3a6 6 0 0 1 5 6v5" fill=${`url(#${f})`} />
    <path d="M24 78h10M58 78h34M116 78h5" /><path class="ill__soft" d="M40 50l-6 12h26V48M66 48v14h26L78 48" />
    <circle cx="46" cy="80" r="10" /><circle cx="104" cy="80" r="10" /><circle cx="46" cy="80" r="3" class="ill__soft" /><circle cx="104" cy="80" r="3" class="ill__soft" />
    <ellipse cx="132" cy="44" rx="12" ry="4" class="ill__disc" /><path d="M120 44v8c0 2 5 4 12 4s12-2 12-4v-8M120 52v8c0 2 5 4 12 4s12-2 12-4v-8" />
    ${sparkle(30, 26)}${sparkle(118, 20, 3)}`,

  // Visite: cartella clinica con battito
  visite: (f) => html`
    <rect x="48" y="20" width="64" height="80" rx="10" fill=${`url(#${f})`} />
    <path d="M68 20v-4a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v4" /><path d="M66 24h28" class="ill__soft" />
    <path d="M58 60h12l5-10 8 20 5-10h14" class="ill__bold" />
    <path class="ill__soft" d="M60 82h24M60 90h16" />
    <path d="M118 36c0-6 8-8 10-2 2-6 10-4 10 2 0 7-10 12-10 12s-10-5-10-12Z" class="ill__leaf" />
    ${sparkle(36, 34)}${sparkle(130, 86, 3)}`,

  // Vaccini: siringa e scudo
  vaccini: (f) => html`
    <path d="M80 18l30 10v24c0 22-14 34-30 42-16-8-30-20-30-42V28Z" fill=${`url(#${f})`} />
    <path d="M66 56l10 10 18-20" class="ill__bold" />
    <path d="M112 92l14-14M120 72l14 14M124 76l-30 30-8 2 2-8 30-30M106 94l-6-6M112 88l-6-6" />
    ${sparkle(40, 30)}${sparkle(128, 40, 3)}`,
};

/**
 * Illustrazione decorativa (aria-hidden): il testo accanto dice già tutto.
 * @param {{ name: keyof typeof SCENES, size?: 'lg'|'sm' }} props
 */
export function Illustration({ name, size = 'lg' }) {
  const id = `ill-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const scene = SCENES[name] || SCENES.oggi;
  return html`<svg class=${`ill ill--${size}`} viewBox="0 0 160 120" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id=${`${id}-f`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="currentColor" stop-opacity=".26" />
        <stop offset="1" stop-color="currentColor" stop-opacity=".04" />
      </linearGradient>
      <radialGradient id=${`${id}-g`} cx=".5" cy=".5" r=".5">
        <stop offset="0" stop-color="currentColor" stop-opacity=".22" />
        <stop offset="1" stop-color="currentColor" stop-opacity="0" />
      </radialGradient>
    </defs>
    <ellipse cx="80" cy="110" rx="58" ry="8" fill=${`url(#${id}-g)`} stroke="none" />
    <g class="ill__lines">${scene(`${id}-f`)}</g>
  </svg>`;
}

export const ILLUSTRATIONS = Object.keys(SCENES);
