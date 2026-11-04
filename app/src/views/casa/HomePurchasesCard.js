import { html } from '../../ui/html.js';
import { GlassCard } from '../../ui/GlassCard.js';
import { NeonBadge } from '../../ui/NeonBadge.js';
import { Icon } from '../../ui/icons.js';
import { showToast } from '../../ui/Toast.js';
import { haptic } from '../../ui/haptics.js';
import { formatEuro } from '../../ui/format.js';
import { getRepo } from '../../store/repo.js';
import { homePurchasesTotal, sortHomePurchases } from '../../domain/home.js';
import { useIncremental } from '../../ui/incremental.js';
import { EmptyNote } from '../../ui/Page.js';

export const PRIORITY = { alta: { status: 'critical', label: 'Alta' }, media: { status: 'warning', label: 'Media' }, bassa: { status: 'unknown', label: 'Bassa' } };
export const HP_CATEGORY_LABEL = { arredamento: 'Arredamento', ferramenta: 'Ferramenta', detersivi: 'Detersivi', bricolage: 'Bricolage', altro: 'Altro' };

/** Da comprare per la casa: lista separata dalla spesa, con priorità e totale stimato. */
export function HomePurchasesCard({ items, onEdit }) {
  const list = sortHomePurchases(items);
  const shown = useIncremental(list.length);
  const total = homePurchasesTotal(items);

  async function toggle(item) {
    const repo = await getRepo();
    await repo.update('homePurchase', item.id, { done: !item.done });
    haptic();
    if (!item.done) showToast({ message: `${item.name} comprato`, onAction: () => repo.update('homePurchase', item.id, { done: false }) });
  }

  return html`
    <${GlassCard} class="hp spring-in" style="--i:3">
      <div class="card-head">
        <div>
          <h2 class="card-title">Da comprare per la casa</h2>
          <p class="card-text">Totale stimato: <strong class="num">${formatEuro(total)}</strong></p>
        </div>
        <button class="btn btn--secondary" type="button" onClick=${() => onEdit(null)}><${Icon} name="plus" /> Aggiungi</button>
      </div>
      ${list.length === 0
        ? html`<${EmptyNote} art="acquisti" accent="var(--mint)">Mensole, lampadine, una tenda nuova: tienili qui, separati dalla spesa.<//>`
        : html`<ul class="item-list">
            ${list.slice(0, shown).map((i) => html`<li key=${i.id} class=${`hp__row${i.done ? ' is-done' : ''}`}>
              <button type="button" class="g-item__check" aria-pressed=${Boolean(i.done)} onClick=${() => toggle(i)}
                aria-label=${i.done ? `Segna ${i.name} da comprare` : `Segna ${i.name} come comprato`}><${Icon} name="check" /></button>
              <button class="item-row" type="button" onClick=${() => onEdit(i)}>
                <span class="item-row__main">
                  <span class="item-row__title">${i.name}</span>
                  <span class="item-row__meta">${HP_CATEGORY_LABEL[i.category] ?? 'Altro'}</span>
                </span>
                ${i.estimatedPrice != null && html`<span class="item-row__value num">${formatEuro(i.estimatedPrice)}</span>`}
                ${!i.done && html`<${NeonBadge} status=${PRIORITY[i.priority]?.status ?? 'unknown'}>${PRIORITY[i.priority]?.label ?? i.priority}<//>`}
              </button>
            </li>`)}
          </ul>`}
    <//>`;
}
