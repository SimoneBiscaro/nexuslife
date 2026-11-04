import { useEffect, useRef, useState } from '../../vendor/preact-hooks.mjs';
import { html } from './html.js';
import { Icon } from './icons.js';
import { Illustration } from './Illustration.js';

/**
 * Intestazione di pagina con titolo serif. Riceve il focus dopo la navigazione
 * (utile a lettori di schermo e tastiera).
 */
export function PageHeader({ eyebrow, title, lede, actions, docTitle }) {
  const ref = useRef(null);
  useEffect(() => {
    document.title = `${docTitle || title} · NexusLife`;
    if (document.documentElement.dataset.navigated === '1') ref.current?.focus({ preventScroll: true });
  }, [title]);
  return html`
    <header class="page-header">
      <div class="page-header__text">
        ${eyebrow && html`<p class="page-eyebrow">${eyebrow}</p>`}
        <h1 class="page-title" tabindex="-1" ref=${ref}>${title}</h1>
        ${lede && html`<p class="page-lede">${lede}</p>`}
      </div>
      ${actions}
    </header>`;
}

/**
 * Stato vuoto curato: illustrazione SVG (`art`) oppure sfera in vetro con l'icona della sezione.
 */
export function EmptyState({ icon, art, title, text, accent = 'var(--champagne)', children }) {
  if (art) {
    return html`
      <div class="empty-state" style=${`--accent:${accent}`}>
        <div class="empty-state__art"><${Illustration} name=${art} /></div>
        <h2 class="empty-state__title">${title}</h2>
        <p class="empty-state__text">${text}</p>
        ${children}
      </div>`;
  }
  return html`
    <div class="empty-state" style=${`--accent:${accent}`}>
      <div class="empty-state__orb" aria-hidden="true">
        <svg class="orb-rings" viewBox="0 0 132 132">
          <circle class="orb-ring orb-ring--a" cx="66" cy="66" r="63" stroke-width="1.5" />
          <circle class="orb-ring orb-ring--b" cx="66" cy="66" r="52" stroke-width="1" />
        </svg>
        <div class="empty-state__core"><${Icon} name=${icon} /></div>
      </div>
      <h2 class="empty-state__title">${title}</h2>
      <p class="empty-state__text">${text}</p>
      ${children}
    </div>`;
}

/** Stato vuoto compatto dentro una card: piccola illustrazione e una frase. */
export function EmptyNote({ art, accent = 'var(--champagne)', children }) {
  return html`<div class="empty-note" style=${`--accent:${accent}`}>
    <${Illustration} name=${art} size="sm" />
    <p class="empty-note__text">${children}</p>
  </div>`;
}

/**
 * Scheletro di caricamento: forme in vetro che anticipano la pagina, così l'arrivo dei dati
 * non sposta nulla. Compare solo se il caricamento supera 120 ms (niente lampi).
 */
export function Skeleton({ cards = 2, rows = 3, label = 'Caricamento' }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 120); return () => clearTimeout(t); }, []);
  return html`<div class=${`skeleton${show ? ' is-visible' : ''}`} role="status" aria-label=${label}>
    ${Array.from({ length: cards }, (_, c) => html`<div class="skeleton__card" key=${c}>
      <span class="skeleton__bar skeleton__bar--title"></span>
      ${Array.from({ length: rows }, (_, r) => html`<span class="skeleton__row" key=${r}>
        <span class="skeleton__dot"></span><span class="skeleton__bar" style=${`width:${[72, 54, 64, 46][(r + c) % 4]}%`}></span>
      </span>`)}
    </div>`)}
  </div>`;
}
