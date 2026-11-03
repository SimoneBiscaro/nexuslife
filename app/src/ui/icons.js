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
  edit: () => html`<path d="M4.5 19.5l1-4L15.8 5.2a2 2 0 0 1 2.9 0l.1.1a2 2 0 0 1 0 2.9L8.5 18.5l-4 1Z" /><path d="M13.5 7.5l3 3" />`,
  trash: () => html`<path d="M4.5 7h15M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M6.5 7l.8 11.2A2 2 0 0 0 9.3 20h5.4a2 2 0 0 0 2-1.8L17.5 7M10 11v5M14 11v5" />`,
  backspace: () => html`<path d="M9 5.5h10a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H9L3.5 12 9 5.5Z" /><path d="M11.5 9.5l5 5M16.5 9.5l-5 5" />`,
  road: () => html`<path d="M8 4 4.5 20M16 4l3.5 16M12 5v2.5M12 10.5V13M12 16v3" />`,
  wrench: () => html`<path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5a4 4 0 0 0-2-2Z" /><path d="M14.5 6.5 17 4l3 3-2.5 2.5" />`,
  leaf: () => html`<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14H5Z" /><path d="M5 19l7-7" />`,
  jar: () => html`<path d="M8 4h8v3H8zM7 7h10l1 2v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9l1-2Z" /><path d="M6 12h12" />`,
  bottle: () => html`<path d="M10 3h4v4l2 3v9a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-9l2-3V3Z" /><path d="M8 13h8" />`,
  spray: () => html`<path d="M9 8h5v3l2 2v6a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-6l1-2V8ZM9 8V5h4l2 1M17 4.5h.5M19 6h.5M17 7.5h.5" />`,
  box: () => html`<path d="M4 8 12 4l8 4v8l-8 4-8-4V8Z" /><path d="M4 8l8 4 8-4M12 12v8" />`,
  paw: () => html`<circle cx="7" cy="10" r="1.6" /><circle cx="10.5" cy="6.5" r="1.6" /><circle cx="13.5" cy="6.5" r="1.6" /><circle cx="17" cy="10" r="1.6" /><path d="M8.5 17c0-3 1.6-5 3.5-5s3.5 2 3.5 5c0 1.6-1.6 2.5-3.5 2.5S8.5 18.6 8.5 17Z" />`,
  gift: () => html`<path d="M4 9h16v4H4zM5.5 13v7h13v-7M12 9v11M12 9c-1.5-3-5-4-5-1.5S10 9 12 9Zm0 0c1.5-3 5-4 5-1.5S14 9 12 9Z" />`,
  baby: () => html`<circle cx="12" cy="12" r="8" /><path d="M9.5 10.5v.2M14.5 10.5v.2M9.5 14.5c1.4 1.2 3.6 1.2 5 0M12 4c-1 1.5 0 3 1.5 3" />`,
  up: () => html`<path d="M6 15l6-6 6 6" />`,
  down: () => html`<path d="M6 9l6 6 6-6" />`,
  more: () => html`<circle cx="6" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18" cy="12" r="1.2" />`,
  mute: () => html`<path d="M4 4l16 16M9 5.5a5 5 0 0 1 8 4V13l1.5 3H10M6.5 9.5V13L5 16h3M10 19a2 2 0 0 0 4 0" />`,
  list: () => html`<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.5M4.5 12h.5M4.5 18h.5" />`,
  euro: () => html`<path d="M17 6.5A6.5 6.5 0 1 0 17 17.5M4.5 10.5h9M4.5 13.5h9" />`,
  bolt: () => html`<path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />`,
  flame: () => html`<path d="M12 21c-3.6 0-6-2.4-6-5.6 0-3.4 2.6-5 3.4-8.4 1.9 1.3 2.6 3 2.6 4.6 1-.6 1.6-1.6 1.8-3 1.8 1.6 2.2 3.6 2.2 5.4C16 18.6 14.6 21 12 21Z" />`,
  wifi: () => html`<path d="M3.5 9.5a12 12 0 0 1 17 0M6.5 12.8a7.6 7.6 0 0 1 11 0M9.5 16a3.4 3.4 0 0 1 5 0" /><path d="M12 19h.01" />`,
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
