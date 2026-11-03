import { useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { GlassCard } from '../../ui/GlassCard.js';
import { NeonBadge } from '../../ui/NeonBadge.js';
import { BarChart } from '../../ui/BarChart.js';
import { Icon } from '../../ui/icons.js';
import { formatDueDate, formatEuro } from '../../ui/format.js';
import { BILL_KINDS, BILL_KIND_LABEL, billTotals, paymentBadge, sortBills } from '../../domain/home.js';

export const BILL_COLORS = {
  luce: 'var(--amber)', gas: 'var(--electric-blue-glow)', internet: 'var(--champagne)',
  acqua: 'var(--mint)', rifiuti: 'var(--titanium-light)', altro: 'var(--health)',
};
const BILL_ICON = { luce: 'bolt', gas: 'flame', internet: 'wifi', acqua: 'bottle', rifiuti: 'trash', altro: 'euro' };
export const billIcon = (kind) => BILL_ICON[kind] || 'euro';

/** Bollette: elenco, totale mensile e annuo per tipo in un piccolo grafico. */
export function BillsCard({ bills, today, onEdit }) {
  const currentYear = today.slice(0, 4);
  const years = [...new Set([currentYear, ...bills.map((b) => b.dueDate?.slice(0, 4)).filter(Boolean)])].sort().reverse();
  const [year, setYear] = useState(currentYear);
  const [showAll, setShowAll] = useState(false);
  const totals = billTotals(bills, year);
  const month = year === currentYear ? Number(today.slice(5, 7)) - 1 : null;
  const list = sortBills(bills).filter((b) => !b.paidAt || b.dueDate?.startsWith(year));
  const visible = showAll ? list : list.slice(0, 6);
  const series = BILL_KINDS.map((k) => ({ key: k, label: BILL_KIND_LABEL[k], color: BILL_COLORS[k], values: totals.matrix[k] }));

  return html`
    <${GlassCard} class="bills spring-in" style="--i:1">
      <div class="card-head">
        <div>
          <h2 class="card-title">Bollette</h2>
          <p class="card-text">${year}: <strong class="num">${formatEuro(totals.total)}</strong>
            ${month !== null && html` · ${new Intl.DateTimeFormat('it-IT', { month: 'long' }).format(new Date(2000, month, 1))} <strong class="num">${formatEuro(totals.months[month])}</strong>`}</p>
        </div>
        <div class="header-actions">
          <label><span class="sr-only">Anno</span>
            <select class="input input--compact" value=${year} onChange=${(e) => setYear(e.currentTarget.value)}>
              ${years.map((y) => html`<option key=${y} value=${y}>${y}</option>`)}
            </select></label>
          <button class="btn btn--secondary" type="button" onClick=${() => onEdit(null)} aria-keyshortcuts="N"><${Icon} name="plus" /> Aggiungi</button>
        </div>
      </div>
      ${totals.total > 0 && html`
        <${BarChart} series=${series} label=${`Bollette ${year} per mese`} highlight=${month} />
        <ul class="legend">
          ${BILL_KINDS.filter((k) => totals.byKind[k] > 0).map((k) => html`
            <li key=${k}><span class="legend__dot" style=${`background:${BILL_COLORS[k]}`}></span>${BILL_KIND_LABEL[k]}
              <span class="num">${formatEuro(totals.byKind[k])}</span></li>`)}
        </ul>`}
      ${list.length === 0
        ? html`<p class="card-text list-empty">Nessuna bolletta registrata${year !== currentYear ? ` nel ${year}` : ''}.</p>`
        : html`<ul class="item-list">
            ${visible.map((b) => {
              const badge = paymentBadge(b, today);
              return html`<li key=${b.id}>
                <button class="item-row" type="button" onClick=${() => onEdit(b)}>
                  <span class="item-row__icon" style=${`--status-color:${BILL_COLORS[b.kind] || BILL_COLORS.altro};--status-text:${BILL_COLORS[b.kind] || BILL_COLORS.altro}`} aria-hidden="true"><${Icon} name=${billIcon(b.kind)} /></span>
                  <span class="item-row__main">
                    <span class="item-row__title">${BILL_KIND_LABEL[b.kind] ?? 'Bolletta'}${b.provider ? ` · ${b.provider}` : ''}</span>
                    <span class="item-row__meta">scade ${formatDueDate(b.dueDate, today)}</span>
                  </span>
                  <span class="item-row__value num">${formatEuro(b.amount)}</span>
                  <${NeonBadge} status=${badge.status}>${badge.label}<//>
                </button></li>`;
            })}
          </ul>
          ${list.length > 6 && html`<button class="btn btn--ghost" type="button" onClick=${() => setShowAll((v) => !v)}>
            ${showAll ? 'Mostra meno' : `Mostra tutte (${list.length})`}</button>`}`}
    <//>`;
}
