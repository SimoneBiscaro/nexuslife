import { useEffect, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { Sheet } from '../../ui/Sheet.js';
import { Icon } from '../../ui/icons.js';
import { formatDueDate, formatLongDate } from '../../ui/format.js';
import { normalizeName, purchaseHistory } from '../../domain/groceries.js';
import { purchaseRhythm } from '../../domain/suggestions.js';

/** Storico acquisti consultabile per prodotto. */
export function HistorySheet({ open, onClose, purchases, today }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  useEffect(() => { if (open) { setQuery(''); setSelected(null); } }, [open]);

  const q = normalizeName(query);
  const list = purchaseHistory(purchases).filter((p) => !q || p.normName.includes(q));
  const product = selected && list.find((p) => p.normName === selected);
  const rhythm = product ? purchaseRhythm(product.dates, today) : null;

  return html`
    <${Sheet} open=${open} onClose=${onClose} title=${product ? product.name : 'Storico acquisti'}>
      ${product
        ? html`
          <button class="btn btn--ghost catalog-back" type="button" onClick=${() => setSelected(null)}><${Icon} name="back" /> Tutti i prodotti</button>
          <dl class="detail-list">
            <div><dt>Acquisti</dt><dd>${product.count}</dd></div>
            <div><dt>Ultimo</dt><dd>${formatLongDate(product.lastDate)}</dd></div>
            <div class="detail-list__wide"><dt>Ritmo</dt><dd>${rhythm ? `di solito ogni ${Math.round(rhythm.cycle)} giorni` : 'servono almeno 3 acquisti negli ultimi 6 mesi'}</dd></div>
          </dl>
          <ul class="item-list">
            ${product.dates.map((d) => html`<li key=${d} class="history-date">${formatLongDate(d)}</li>`)}
          </ul>`
        : html`
          <label class="field" style="margin-bottom:var(--space-3)">
            <${Icon} name="search" />
            <span class="sr-only">Cerca prodotto</span>
            <input type="search" placeholder="Cerca prodotto" value=${query} onInput=${(e) => setQuery(e.currentTarget.value)} />
          </label>
          ${list.length === 0
            ? html`<p class="card-text list-empty">${purchases.length ? 'Nessun prodotto trovato.' : 'Lo storico si riempie quando concludi una spesa.'}</p>`
            : html`<ul class="item-list">
                ${list.map((p) => html`<li key=${p.normName}>
                  <button class="item-row" type="button" onClick=${() => setSelected(p.normName)}>
                    <span class="item-row__main">
                      <span class="item-row__title">${p.name}</span>
                      <span class="item-row__meta">ultimo ${formatDueDate(p.lastDate, today)}</span>
                    </span>
                    <span class="item-row__value num">${p.count}×</span>
                  </button></li>`)}
              </ul>`}`}
    <//>`;
}
