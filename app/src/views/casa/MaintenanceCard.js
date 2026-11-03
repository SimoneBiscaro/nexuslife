import { html } from '../../ui/html.js';
import { GlassCard } from '../../ui/GlassCard.js';
import { NeonBadge } from '../../ui/NeonBadge.js';
import { Icon } from '../../ui/icons.js';
import { showToast } from '../../ui/Toast.js';
import { haptic } from '../../ui/haptics.js';
import { formatDueDate } from '../../ui/format.js';
import { getRepo } from '../../store/repo.js';
import { sortMaintenance } from '../../domain/home.js';
import { daysLabel } from '../../domain/overview.js';

/** Manutenzioni periodiche con stato calcolato e "Fatto oggi". */
export function MaintenanceCard({ items, today, onEdit }) {
  const list = sortMaintenance(items, today);

  async function doneToday(item) {
    const repo = await getRepo();
    const previous = item.lastDoneDate ?? null;
    await repo.update('homeMaintenance', item.id, { lastDoneDate: today });
    haptic();
    showToast({ message: `${item.title}: fatto oggi`, onAction: () => repo.update('homeMaintenance', item.id, { lastDoneDate: previous }) });
  }

  return html`
    <${GlassCard} class="maint spring-in" style="--i:2">
      <div class="card-head">
        <h2 class="card-title">Manutenzioni</h2>
        <button class="btn btn--secondary" type="button" onClick=${() => onEdit(null)}><${Icon} name="plus" /> Aggiungi</button>
      </div>
      ${list.length === 0
        ? html`<p class="card-text list-empty">Caldaia, filtri del condizionatore, cappa: aggiungi ciò che va controllato a intervalli regolari.</p>`
        : html`<ul class="item-list">
            ${list.map(({ item, nextDate, status, days }) => html`<li key=${item.id} class="maint__row">
              <button class="item-row" type="button" onClick=${() => onEdit(item)}>
                <span class="item-row__icon" data-status=${status} aria-hidden="true"><${Icon} name="wrench" /></span>
                <span class="item-row__main">
                  <span class="item-row__title">${item.title}</span>
                  <span class="item-row__meta">ogni ${item.intervalMonths} ${item.intervalMonths === 1 ? 'mese' : 'mesi'}${nextDate ? ` · prossima ${formatDueDate(nextDate, today)}` : ' · mai fatta'}</span>
                </span>
                <${NeonBadge} status=${status}>${nextDate ? daysLabel(days) : 'da fare'}<//>
              </button>
              ${item.lastDoneDate !== today && html`<button class="icon-btn maint__done" type="button" onClick=${() => doneToday(item)}
                aria-label=${`${item.title}: fatto oggi`}><${Icon} name="check" /></button>`}
            </li>`)}
          </ul>`}
    <//>`;
}
