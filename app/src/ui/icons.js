import { useId } from '../../vendor/preact-hooks.mjs';
import { html } from './html.js';

/** Icone a tratto (24×24), disegnate a mano. */
const PATHS = {
  oggi: () => html`<circle cx="12" cy="12" r="4" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />`,
  auto: () => html`<path d="M5.4 16.6H4.2a1 1 0 0 1-1-1V13l2-4.6a1.6 1.6 0 0 1 1.5-.9h10.6a1.6 1.6 0 0 1 1.5.9L21 13v2.6a1 1 0 0 1-1 1h-1.4M9.3 16.6h5.4M3.6 12.6h16.8" /><circle cx="7.4" cy="16.6" r="1.9" /><circle cx="16.6" cy="16.6" r="1.9" />`,
  casa: () => html`<path d="M3.5 11 12 4l8.5 7" /><path d="M5.5 9.5V19a1 1 0 0 0 1 1H10v-5.5h4V20h3.5a1 1 0 0 0 1-1V9.5" />`,
  spesa: () => html`<path d="M4 9.5h16l-1.6 8.6a2 2 0 0 1-2 1.6H7.6a2 2 0 0 1-2-1.6L4 9.5ZM8.5 9.5 11 4.5M15.5 9.5 13 4.5M9.5 13v3.5M14.5 13v3.5" />`,
  salute: () => html`<path d="M12 20s-7.5-4.4-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.6 12 20 12 20Z" /><path d="M7.2 12.4h2.3l1.4-2.3 2 4.4 1.4-2.1h2.5" />`,
  impostazioni: () => html`<path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2.2" /><circle cx="8" cy="17" r="2.2" />`,
  close: () => html`<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />`,
  search: () => html`<circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" />`,
  plus: () => html`<path d="M12 5v14M5 12h14" />`,
  check: () => html`<path d="M5 12.5l4.5 4.5L19 7.5" />`,
  alert: () => html`<path d="M12 4.5 21 19.5H3L12 4.5Z" /><path d="M12 10v4M12 16.8v.2" />`,
  info: () => html`<circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.8v.2" />`,
  clock: () => html`<circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" />`,
  back: () => html`<path d="M14.5 6 8.5 12l6 6" />`,
  sparkle: () => html`<path d="M12 3.5c.6 4.2 2.3 6 6.5 6.5-4.2.6-5.9 2.3-6.5 6.5-.6-4.2-2.3-5.9-6.5-6.5 4.2-.5 5.9-2.3 6.5-6.5ZM18.5 15.5c.3 1.8 1 2.6 2.8 2.8-1.8.3-2.5 1-2.8 2.8-.3-1.8-1-2.5-2.8-2.8 1.8-.2 2.5-1 2.8-2.8Z" />`,
  refresh: () => html`<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v3.8h-3.8" />`,
  layers: () => html`<path d="M12 4 3.5 8.5 12 13l8.5-4.5L12 4Z" /><path d="M3.5 12.5 12 17l8.5-4.5M3.5 16.2 12 20.7l8.5-4.5" />`,
};

/**
 * @param {{ name: keyof typeof PATHS, class?: string, label?: string }} props
 * Senza `label` l'icona è decorativa (aria-hidden).
 */
export function Icon({ name, class: cls = '', label }) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true', focusable: 'false' };
  return html`<svg class=${cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ...${a11y}>${PATHS[name]?.()}</svg>`;
}

/** Monogramma "N" del brand (stesso disegno delle icone PWA). */
export function BrandMark({ class: cls = 'brand-mark' }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const gold = `bm-gold-${uid}`;
  const bg = `bm-bg-${uid}`;
  return html`<svg class=${cls} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id=${gold} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#F2E3C2" /><stop offset=".55" stop-color="#D9BF8C" /><stop offset="1" stop-color="#9C8355" />
      </linearGradient>
      <radialGradient id=${bg} cx=".3" cy=".2" r=".95">
        <stop offset="0" stop-color="#25221D" /><stop offset=".6" stop-color="#111114" /><stop offset="1" stop-color="#0A0A0C" />
      </radialGradient>
    </defs>
    <rect x=".5" y=".5" width="63" height="63" rx="15" fill=${`url(#${bg})`} stroke="rgba(255,255,255,.12)" />
    <path d="M22 44V20l20 24V20" fill="none" stroke=${`url(#${gold})`} stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`;
}
