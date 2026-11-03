import { useEffect, useRef, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { Icon } from '../../ui/icons.js';
import { NeonBadge } from '../../ui/NeonBadge.js';
import { showToast } from '../../ui/Toast.js';
import { haptic } from '../../ui/haptics.js';
import { colorVar, iconName } from '../../ui/palette.js';
import { getRepo } from '../../store/repo.js';
import { findOpenItem, mergeQuickAdd, parseQuickAdd, sortCategories, suggestCategory } from '../../domain/groceries.js';

/** Campo di aggiunta rapida con anteprima live del parser (§7). */
export function QuickAdd({ items, categories, purchases }) {
  const [text, setText] = useState('');
  const [override, setOverride] = useState(null);
  const [picking, setPicking] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const onNew = () => inputRef.current?.focus();
    window.addEventListener('nexus:new', onNew);
    return () => window.removeEventListener('nexus:new', onNew);
  }, []);

  const parsed = parseQuickAdd(text);
  const cats = sortCategories(categories);
  const proposed = parsed ? suggestCategory(parsed.normName, { categories, history: [...purchases, ...items] }) : null;
  const categoryId = override && cats.some((c) => c.id === override) ? override : proposed;
  const category = cats.find((c) => c.id === categoryId);

  async function submit(e) {
    e.preventDefault();
    if (!parsed) return;
    const repo = await getRepo();
    const now = new Date().toISOString();
    const existing = findOpenItem(items, parsed.normName);
    if (existing) {
      const patch = mergeQuickAdd(existing, { ...parsed, addedAt: now });
      if (patch) await repo.update('groceryItem', existing.id, patch);
      showToast({ message: patch ? `${existing.name} aggiornato` : `${existing.name} è già in lista`, status: patch ? 'ok' : 'unknown', duration: 2500 });
    } else {
      const item = await repo.create('groceryItem', {
        name: parsed.name, normName: parsed.normName, quantity: parsed.quantity, urgency: parsed.urgency,
        categoryId, addedAt: now, checkedAt: null, archived: false,
      });
      haptic();
      showToast({ message: `Aggiunto: ${item.name}`, onAction: () => repo.softDelete('groceryItem', item.id) });
    }
    setText('');
    setOverride(null);
    setPicking(false);
    inputRef.current?.focus();
  }

  return html`
    <form class="quick-add glass" onSubmit=${submit} role="search" aria-label="Aggiungi alla lista">
      <div class="quick-add__row">
        <${Icon} name="plus" class="quick-add__icon" />
        <label class="sr-only" for="quick-add-input">Aggiungi un articolo</label>
        <input id="quick-add-input" ref=${inputRef} class="quick-add__input" data-search
          placeholder="Aggiungi… es. latte x2!" value=${text} autocomplete="off" autocorrect="off" enterkeyhint="done"
          onInput=${(e) => setText(e.currentTarget.value)} aria-describedby="quick-add-help" />
        <button class="btn btn--primary quick-add__go" type="submit" disabled=${!parsed} aria-label="Aggiungi">
          <${Icon} name="check" />
        </button>
      </div>
      ${parsed
        ? html`<div class="quick-add__preview" aria-live="polite">
            <span class="quick-add__name">${parsed.name}</span>
            ${parsed.quantity > 1 && html`<span class="qty">×${parsed.quantity}</span>`}
            ${parsed.urgency === 'urgente' && html`<${NeonBadge} status="warning">Urgente<//>`}
            ${parsed.urgency === 'scorta' && html`<${NeonBadge} status="unknown">Scorta<//>`}
            ${category && html`<button type="button" class="cat-chip" style=${`--cat:${colorVar(category.color)}`}
              aria-expanded=${picking} onClick=${() => setPicking((v) => !v)} aria-label=${`Categoria: ${category.name}. Tocca per cambiarla`}>
              <${Icon} name=${iconName(category.icon)} /> ${category.name}
            </button>`}
          </div>`
        : html`<p class="quick-add__help" id="quick-add-help"><b>x2</b> quantità · <b>!</b> urgente · <b>*</b> scorta</p>`}
      ${parsed && picking && html`
        <div class="cat-picker" role="group" aria-label="Scegli la categoria">
          ${cats.map((c) => html`<button type="button" key=${c.id} class=${`cat-chip${c.id === categoryId ? ' is-on' : ''}`}
            style=${`--cat:${colorVar(c.color)}`} aria-pressed=${c.id === categoryId}
            onClick=${() => { setOverride(c.id); setPicking(false); inputRef.current?.focus(); }}>
            <${Icon} name=${iconName(c.icon)} /> ${c.name}</button>`)}
        </div>`}
    </form>`;
}
