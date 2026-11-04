import { useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { GlassCard } from '../../ui/GlassCard.js';
import { ChipGroup } from '../../ui/forms.js';
import { Icon } from '../../ui/icons.js';
import { formatEuro, formatKm, formatShortDate } from '../../ui/format.js';
import { useIncremental } from '../../ui/incremental.js';
import { EmptyNote } from '../../ui/Page.js';

export const EXPENSE_CATEGORIES = [
  { value: 'tagliando', label: 'Tagliando' },
  { value: 'riparazione', label: 'Riparazione' },
  { value: 'gomme', label: 'Gomme' },
  { value: 'carburante', label: 'Carburante' },
  { value: 'altro', label: 'Altro' },
];
const CATEGORY_LABEL = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.value, c.label]));

/** Storico spese e interventi con filtri per categoria e anno e totale annuo. */
export function ExpensesCard({ expenses, onEdit, today }) {
  const currentYear = today.slice(0, 4);
  const years = [...new Set([currentYear, ...expenses.map((e) => e.date.slice(0, 4))])].sort().reverse();
  const [year, setYear] = useState(currentYear);
  const [category, setCategory] = useState('tutte');

  const list = expenses
    .filter((e) => e.date.startsWith(year) && (category === 'tutte' || e.category === category))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const shown = useIncremental(list.length);
  const total = list.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  return html`
    <${GlassCard} class="expenses spring-in" style="--i:6">
      <div class="card-head">
        <div>
          <h2 class="card-title">Spese e interventi</h2>
          <p class="card-text">Totale ${year}${category !== 'tutte' ? ` · ${CATEGORY_LABEL[category]}` : ''}:${' '}
            <strong class="num expenses__total">${formatEuro(total)}</strong></p>
        </div>
        <button class="btn btn--secondary" type="button" onClick=${() => onEdit(null)} aria-keyshortcuts="N">
          <${Icon} name="plus" /> Aggiungi
        </button>
      </div>
      <div class="filters">
        <${ChipGroup} label="Categoria" value=${category} onValue=${setCategory}
          options=${[{ value: 'tutte', label: 'Tutte' }, ...EXPENSE_CATEGORIES]} />
        <label class="year-select">
          <span class="sr-only">Anno</span>
          <select class="input input--compact" value=${year} onChange=${(e) => setYear(e.currentTarget.value)}>
            ${years.map((y) => html`<option value=${y} key=${y}>${y}</option>`)}
          </select>
        </label>
      </div>
      ${list.length === 0
        ? html`<${EmptyNote} art="auto" accent="var(--electric-blue-glow)">Nessuna spesa ${category !== 'tutte' ? `di tipo ${CATEGORY_LABEL[category].toLowerCase()} ` : ''}nel ${year}.<//>`
        : html`<ul class="item-list">
            ${list.slice(0, shown).map((e) => html`
              <li key=${e.id}>
                <button class="item-row" type="button" onClick=${() => onEdit(e)}>
                  <span class="item-row__icon" data-cat=${e.category} aria-hidden="true"><${Icon} name=${e.category === 'carburante' ? 'road' : 'wrench'} /></span>
                  <span class="item-row__main">
                    <span class="item-row__title">${e.description || CATEGORY_LABEL[e.category]}</span>
                    <span class="item-row__meta">${formatShortDate(e.date)} · ${CATEGORY_LABEL[e.category]}${e.km ? ` · ${formatKm(e.km)}` : ''}</span>
                  </span>
                  <span class="item-row__value num">${formatEuro(e.amount)}</span>
                </button>
              </li>`)}
          </ul>`}
    <//>`;
}
