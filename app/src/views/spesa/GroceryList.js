import { useRef, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { Icon } from '../../ui/icons.js';
import { NeonBadge } from '../../ui/NeonBadge.js';
import { showToast } from '../../ui/Toast.js';
import { haptic } from '../../ui/haptics.js';
import { colorVar, iconName } from '../../ui/palette.js';
import { getRepo } from '../../store/repo.js';
import { concludeShopping, groupByCategory, urgencyGlow } from '../../domain/groceries.js';

const SWIPE_PX = 72;

async function toggleChecked(item) {
  const repo = await getRepo();
  const checkedAt = item.checkedAt ? null : new Date().toISOString();
  await repo.update('groceryItem', item.id, { checkedAt });
  haptic();
  if (checkedAt) {
    showToast({ message: `${item.name} spuntato`, onAction: () => repo.update('groceryItem', item.id, { checkedAt: null }) });
  }
}

function ItemRow({ item, now, onEdit }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef(null);
  const swiped = useRef(false);
  const glow = item.checkedAt ? null : urgencyGlow(item, now);

  const onPointerDown = (e) => {
    if (e.target.closest('.g-item__check')) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, active: false };
  };
  const onPointerMove = (e) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const mx = e.clientX - s.x;
    if (!s.active) {
      if (Math.abs(mx) < 10 || Math.abs(mx) < Math.abs(e.clientY - s.y)) return;
      s.active = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
    }
    setDx(Math.max(0, Math.min(140, mx)));
  };
  const onPointerUp = (e) => {
    const s = start.current;
    start.current = null;
    if (!s?.active) return;
    swiped.current = true;
    setTimeout(() => { swiped.current = false; }, 0);
    setDragging(false);
    const mx = e.clientX - s.x;
    setDx(0);
    if (mx > SWIPE_PX) toggleChecked(item);
  };
  // Dopo uno swipe il "click" che segue non deve aprire il dettaglio.
  const onClickCapture = (e) => { if (swiped.current) { e.stopPropagation(); e.preventDefault(); } };

  return html`
    <li class=${`g-item${item.checkedAt ? ' is-checked' : ''}${dragging ? ' is-dragging' : ''}`} data-glow=${glow}>
      <div class="g-item__swipe-bg" aria-hidden="true" style=${`opacity:${Math.min(1, dx / SWIPE_PX)}`}><${Icon} name="check" /></div>
      <div class="g-item__body" style=${`transform:translateX(${dx}px)`}
        onPointerDown=${onPointerDown} onPointerMove=${onPointerMove} onPointerUp=${onPointerUp} onPointerCancel=${onPointerUp}
        onClickCapture=${onClickCapture}>
        <button type="button" class="g-item__check" onClick=${() => toggleChecked(item)}
          aria-pressed=${Boolean(item.checkedAt)} aria-label=${item.checkedAt ? `Togli la spunta a ${item.name}` : `Spunta ${item.name}`}>
          <${Icon} name="check" />
        </button>
        <button type="button" class="g-item__main" onClick=${() => onEdit(item)}>
          <span class="g-item__name">${item.name}</span>
          ${item.quantity > 1 && html`<span class="qty">×${item.quantity}</span>`}
        </button>
        ${glow && html`<${NeonBadge} status=${glow === 'critical' ? 'critical' : 'warning'} pulse=${glow === 'critical'}>Urgente<//>`}
        ${!item.checkedAt && item.urgency === 'scorta' && html`<${NeonBadge} status="unknown">Scorta<//>`}
      </div>
    </li>`;
}

/** Lista della spesa raggruppata per categoria, con "Concludi spesa". */
export function GroceryList({ items, categories, onEdit }) {
  const now = new Date();
  const groups = groupByCategory(items, categories);
  const checked = items.filter((i) => !i.archived && i.checkedAt);

  async function conclude() {
    const repo = await getRepo();
    const { purchases, archive } = concludeShopping(items, new Date());
    const created = purchases.map((p) => ({ ...p, id: crypto.randomUUID() }));
    await repo.batch([
      ...created.map((create) => ({ entity: 'groceryPurchase', create })),
      ...archive.map((a) => ({ entity: 'groceryItem', id: a.id, patch: { archived: true } })),
    ]);
    haptic(20);
    showToast({
      message: `Spesa conclusa: ${created.length === 1 ? '1 articolo' : `${created.length} articoli`}`,
      onAction: () => repo.batch([
        ...created.map((p) => ({ entity: 'groceryPurchase', id: p.id, patch: { deleted: true } })),
        ...archive.map((a) => ({ entity: 'groceryItem', id: a.id, patch: { archived: false } })),
      ]),
    });
  }

  if (!groups.length) {
    return html`<p class="card-text list-empty">La lista è vuota. Scrivi qui sopra cosa manca.</p>`;
  }

  return html`
    <div class="g-list">
      ${groups.map(({ category, items: list }) => html`
        <section class="g-group" key=${category.id} style=${`--cat:${colorVar(category.color)}`} aria-label=${category.name}>
          <h2 class="g-group__title"><${Icon} name=${iconName(category.icon)} /> ${category.name}
            <span class="g-group__count">${list.filter((i) => !i.checkedAt).length}</span></h2>
          <ul class="g-group__items">
            ${list.map((item) => html`<${ItemRow} key=${item.id} item=${item} now=${now} onEdit=${onEdit} />`)}
          </ul>
        </section>`)}
      ${checked.length > 0 && html`
        <div class="conclude">
          <button class="btn btn--primary" type="button" onClick=${conclude}>
            <${Icon} name="check" /> Concludi spesa (${checked.length})
          </button>
          <p class="form-hint">Gli spuntati vengono archiviati e registrati nello storico.</p>
        </div>`}
    </div>`;
}
