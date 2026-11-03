import { useEffect, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { Sheet } from '../../ui/Sheet.js';
import { Icon } from '../../ui/icons.js';
import { showToast } from '../../ui/Toast.js';
import { CATEGORY_COLORS, CATEGORY_ICONS, colorVar, iconName } from '../../ui/palette.js';
import { getRepo } from '../../store/repo.js';
import { normalizeName, reassignDeletedCategory, reorderCategories, sortCategories } from '../../domain/groceries.js';

function CategoryRow({ cat, index, count, all, onRename, onMove, onPatch, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState(cat.name);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setName(cat.name), [cat.name]);

  return html`
    <li class="cat-row" style=${`--cat:${colorVar(cat.color)}`}>
      <div class="cat-row__main">
        <button type="button" class="cat-row__icon" onClick=${() => setExpanded((v) => !v)} aria-expanded=${expanded}
          aria-label=${`Icona e colore di ${cat.name}`}><${Icon} name=${iconName(cat.icon)} /></button>
        <label class="sr-only" for=${`cat-${cat.id}`}>Nome categoria</label>
        <input id=${`cat-${cat.id}`} class="input cat-row__name" value=${name} onInput=${(e) => setName(e.currentTarget.value)}
          onBlur=${() => onRename(cat, name, () => setName(cat.name))}
          onKeyDown=${(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
        <button type="button" class="icon-btn" onClick=${() => onMove(cat, -1)} disabled=${index === 0} aria-label=${`Sposta ${cat.name} su`}><${Icon} name="up" /></button>
        <button type="button" class="icon-btn" onClick=${() => onMove(cat, 1)} disabled=${index === count - 1} aria-label=${`Sposta ${cat.name} giù`}><${Icon} name="down" /></button>
      </div>
      ${expanded && html`
        <div class="cat-row__more">
          <div class="swatch-row" role="group" aria-label="Icona">
            ${CATEGORY_ICONS.map((ic) => html`<button type="button" key=${ic} class=${`pick${cat.icon === ic ? ' is-on' : ''}`}
              aria-pressed=${cat.icon === ic} aria-label=${`Icona ${ic}`} onClick=${() => onPatch(cat, { icon: ic })}><${Icon} name=${ic} /></button>`)}
          </div>
          <div class="swatch-row" role="group" aria-label="Colore">
            ${Object.keys(CATEGORY_COLORS).map((c) => html`<button type="button" key=${c} class=${`pick pick--color${cat.color === c ? ' is-on' : ''}`}
              style=${`--swatch:${colorVar(c)}`} aria-pressed=${cat.color === c} aria-label=${`Colore ${c}`}
              onClick=${() => onPatch(cat, { color: c })}></button>`)}
          </div>
          ${cat.builtin
            ? html`<p class="form-hint">Categoria predefinita: si può rinominare ma non eliminare.</p>`
            : html`<button type="button" class=${`btn ${confirm ? 'btn--danger' : 'btn--secondary'}`}
                onClick=${() => (confirm ? onDelete(cat) : setConfirm(true))}>
                <${Icon} name="trash" /> ${confirm ? 'Conferma: gli articoli vanno in Altro' : 'Elimina categoria'}
              </button>`}
        </div>`}
    </li>`;
}

/** Editor categorie: crea, rinomina, icona, colore, ordine, elimina (articoli → Altro). */
export function CategoryEditor({ open, onClose, categories, items, purchases }) {
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setNewName(''); setError(''); } }, [open]);
  const list = sortCategories(categories);
  const taken = (norm, exceptId) => list.some((c) => c.id !== exceptId && c.normName === norm);

  async function create(e) {
    e.preventDefault();
    const name = newName.trim();
    const normName = normalizeName(name);
    if (!name) return;
    if (taken(normName)) { setError('Esiste già una categoria con questo nome'); return; }
    const repo = await getRepo();
    await repo.create('groceryCategory', { name, normName, icon: 'box', color: 'champagne', builtin: false, order: list.length });
    setNewName('');
    setError('');
  }

  async function rename(cat, value, reset) {
    const name = value.trim();
    if (name === cat.name) return;
    if (!name || (!cat.builtin && taken(normalizeName(name), cat.id))) {
      reset();
      showToast({ message: name ? 'Nome già usato da un\'altra categoria' : 'Il nome non può essere vuoto', status: 'warning', duration: 3000 });
      return;
    }
    const repo = await getRepo();
    // Le predefinite mantengono il normName: è la chiave usata dal dizionario delle parole chiave.
    await repo.update('groceryCategory', cat.id, cat.builtin ? { name } : { name, normName: normalizeName(name) });
  }

  async function move(cat, delta) {
    const changes = reorderCategories(list, cat.id, delta);
    if (!changes.length) return;
    const repo = await getRepo();
    await repo.batch(changes.map((c) => ({ entity: 'groceryCategory', id: c.id, patch: { order: c.order } })));
  }

  async function patch(cat, fields) {
    const repo = await getRepo();
    await repo.update('groceryCategory', cat.id, fields);
  }

  async function remove(cat) {
    const altro = list.find((c) => c.normName === 'altro' && c.builtin) || list.find((c) => c.normName === 'altro');
    if (!altro || cat.builtin) return;
    const moves = reassignDeletedCategory([...items, ...purchases], cat.id, altro.id);
    const repo = await getRepo();
    await repo.batch([
      ...moves.map((m) => ({ entity: m.entity, id: m.id, patch: { categoryId: altro.id } })),
      { entity: 'groceryCategory', id: cat.id, patch: { deleted: true } },
    ]);
    showToast({
      message: `${cat.name} eliminata${moves.length ? `: ${moves.length} in Altro` : ''}`,
      onAction: () => repo.batch([
        { entity: 'groceryCategory', id: cat.id, patch: { deleted: false } },
        ...moves.map((m) => ({ entity: m.entity, id: m.id, patch: { categoryId: cat.id } })),
      ]),
    });
  }

  return html`
    <${Sheet} open=${open} onClose=${onClose} title="Categorie">
      <ul class="cat-list">
        ${list.map((cat, i) => html`<${CategoryRow} key=${cat.id} cat=${cat} index=${i} count=${list.length} all=${list}
          onRename=${rename} onMove=${move} onPatch=${patch} onDelete=${remove} />`)}
      </ul>
      <form class="cat-new" onSubmit=${create}>
        <label class="sr-only" for="cat-new-name">Nuova categoria</label>
        <input id="cat-new-name" class="input" placeholder="Nuova categoria" value=${newName}
          onInput=${(e) => { setNewName(e.currentTarget.value); setError(''); }} aria-describedby=${error ? 'cat-new-err' : undefined} />
        <button class="btn btn--primary" type="submit" disabled=${!newName.trim()}><${Icon} name="plus" /> Crea</button>
      </form>
      ${error && html`<p class="form-error" id="cat-new-err" role="alert">${error}</p>`}
    <//>`;
}
