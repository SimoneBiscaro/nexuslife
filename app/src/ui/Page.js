import { useEffect, useRef } from '../../vendor/preact-hooks.mjs';
import { html } from './html.js';
import { Icon } from './icons.js';

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

/** Stato vuoto curato: sfera in vetro con l'icona della sezione. */
export function EmptyState({ icon, title, text, accent = 'var(--champagne)', children }) {
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
