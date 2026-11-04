import { html } from '../../ui/html.js';
import { GlassCard } from '../../ui/GlassCard.js';
import { NeonBadge } from '../../ui/NeonBadge.js';
import { Icon } from '../../ui/icons.js';
import { showToast } from '../../ui/Toast.js';
import { haptic } from '../../ui/haptics.js';
import { formatDueDate, formatKm } from '../../ui/format.js';
import { getRepo } from '../../store/repo.js';
import { markDonePatch, recurrenceLabel, sortMaintenancePlans } from '../../domain/maintenance.js';
import { STATUS_SEVERITY } from '../../domain/deadlines.js';
import { daysLabel } from '../../domain/overview.js';
import { useIncremental } from '../../ui/incremental.js';
import { EmptyNote } from '../../ui/Page.js';

const COPY = {
  homeMaintenance: {
    title: 'Manutenzioni', art: 'manutenzioni', accent: 'var(--mint)',
    empty: 'Caldaia, filtri del condizionatore, una stanza da imbiancare: periodiche o una tantum, tienile qui.',
  },
  vehicleMaintenance: {
    title: 'Manutenzioni auto', art: 'manutenzioni', accent: 'var(--electric-blue-glow)',
    empty: 'Cambio olio, liquido freni, batteria: a mesi, a km o una volta sola.',
  },
};

/** Riga di dettaglio: ricorrenza e prossima scadenza (data o km). */
function metaOf(p, today) {
  const { item } = p;
  if (p.done) return `una tantum · fatta ${formatDueDate(item.doneAt, today)}`;
  if (!p.periodic) return `una tantum · ${p.nextDate ? `entro ${formatDueDate(p.nextDate, today)}` : 'senza data'}`;
  const parts = [recurrenceLabel(item, formatKm)];
  if (p.nextDate) parts.push(`prossima ${formatDueDate(p.nextDate, today)}`);
  if (p.nextKm !== null) parts.push(`a ${formatKm(p.nextKm)}`);
  if (!p.nextDate && p.nextKm === null) parts.push('mai fatta');
  return parts.join(' · ');
}

/** Testo del badge: giorni o km mancanti, "da fare", "fatta". */
function badgeOf(p) {
  if (p.done) return 'fatta';
  if (p.kmRemaining !== null && STATUS_SEVERITY[p.kmStatus] > STATUS_SEVERITY[p.dateStatus]) {
    return p.kmRemaining < 0 ? `${formatKm(-p.kmRemaining)} oltre` : `tra ${formatKm(p.kmRemaining)}`;
  }
  return p.days !== null ? daysLabel(p.days) : 'da fare';
}

/**
 * Manutenzioni di casa o auto, periodiche e una tantum, con "Fatto oggi".
 * @param {{ items, today, onEdit, entity?: string, currentKm?: number, kmPerDay?: number, index?: number }} props
 */
export function MaintenanceCard({ items, today, onEdit, entity = 'homeMaintenance', currentKm, kmPerDay, index = 2 }) {
  const copy = COPY[entity];
  const list = sortMaintenancePlans(items, today, { currentKm, kmPerDay });
  const shown = useIncremental(list.length);

  async function toggleDone(item, done) {
    const repo = await getRepo();
    if (done) {
      await repo.update(entity, item.id, { doneAt: null });
      return;
    }
    const patch = markDonePatch(item, today, currentKm);
    const before = Object.fromEntries(Object.keys(patch).map((k) => [k, item[k] ?? null]));
    await repo.update(entity, item.id, patch);
    haptic();
    showToast({ message: `${item.title}: fatto oggi`, onAction: () => repo.update(entity, item.id, before) });
  }

  return html`
    <${GlassCard} class="maint spring-in" style=${`--i:${index}`}>
      <div class="card-head">
        <h2 class="card-title">${copy.title}</h2>
        <button class="btn btn--secondary" type="button" onClick=${() => onEdit(null)}><${Icon} name="plus" /> Aggiungi</button>
      </div>
      ${list.length === 0
        ? html`<${EmptyNote} art=${copy.art} accent=${copy.accent}>${copy.empty}<//>`
        : html`<ul class="item-list">
            ${list.slice(0, shown).map((p) => html`<li key=${p.item.id} class=${`maint__row${p.done ? ' is-done' : ''}`}>
              <button class="item-row" type="button" onClick=${() => onEdit(p.item)}>
                <span class="item-row__icon" data-status=${p.done ? 'ok' : p.status} aria-hidden="true"><${Icon} name="wrench" /></span>
                <span class="item-row__main">
                  <span class="item-row__title">${p.item.title}</span>
                  <span class="item-row__meta">${metaOf(p, today)}</span>
                </span>
                <${NeonBadge} status=${p.done ? 'ok' : p.status}>${badgeOf(p)}<//>
              </button>
              ${p.done
                ? html`<button class="icon-btn maint__undo" type="button" onClick=${() => toggleDone(p.item, true)}
                    aria-label=${`${p.item.title}: segna da fare`}><${Icon} name="refresh" /></button>`
                : p.item.lastDoneDate !== today && html`<button class="icon-btn maint__done" type="button" onClick=${() => toggleDone(p.item, false)}
                    aria-label=${`${p.item.title}: fatto oggi`}><${Icon} name="check" /></button>`}
            </li>`)}
          </ul>`}
    <//>`;
}
