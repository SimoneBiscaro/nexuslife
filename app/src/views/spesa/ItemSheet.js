import { useEffect, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { Sheet } from '../../ui/Sheet.js';
import { Icon } from '../../ui/icons.js';
import { TextField, SelectField, Segmented } from '../../ui/forms.js';
import { showToast } from '../../ui/Toast.js';
import { getRepo } from '../../store/repo.js';
import { normalizeName, sortCategories } from '../../domain/groceries.js';

const URGENCIES = [{ value: 'scorta', label: 'Scorta' }, { value: 'normale', label: 'Normale' }, { value: 'urgente', label: 'Urgente' }];

/** Modifica ed eliminazione di un articolo della lista. */
export function ItemSheet({ item, categories, onClose }) {
  const open = Boolean(item);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  useEffect(() => {
    if (item) {
      setForm({ name: item.name, quantity: String(item.quantity || 1), urgency: item.urgency, categoryId: item.categoryId });
      setError('');
    }
  }, [item?.id]);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    const quantity = Number(form.quantity);
    if (!form.name?.trim()) { setError('Il nome non può essere vuoto'); return; }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) { setError('Quantità tra 1 e 999'); return; }
    const repo = await getRepo();
    const urgencyChanged = form.urgency !== item.urgency && form.urgency === 'urgente';
    await repo.update('groceryItem', item.id, {
      name: form.name.trim(), normName: normalizeName(form.name), quantity, urgency: form.urgency, categoryId: form.categoryId,
      ...(urgencyChanged ? { addedAt: new Date().toISOString() } : {}),
    });
    onClose();
  }

  async function remove() {
    const repo = await getRepo();
    await repo.softDelete('groceryItem', item.id);
    onClose();
    showToast({ message: `${item.name} rimosso`, onAction: () => repo.update('groceryItem', item.id, { deleted: false }) });
  }

  const footer = html`
    <button class="btn btn--danger footer-start" type="button" onClick=${remove}><${Icon} name="trash" /> Rimuovi</button>
    <button class="btn btn--secondary" type="button" onClick=${onClose}>Annulla</button>
    <button class="btn btn--primary" type="button" onClick=${save}>Salva</button>`;

  return html`
    <${Sheet} open=${open} onClose=${onClose} title="Articolo" footer=${footer}>
      ${open && html`<form class="form-grid" onSubmit=${(e) => { e.preventDefault(); save(); }} noValidate>
        <${TextField} label="Nome" value=${form.name} onValue=${set('name')} error=${error} />
        <${TextField} label="Quantità" value=${form.quantity} onValue=${set('quantity')} inputmode="numeric" />
        <${SelectField} label="Categoria" value=${form.categoryId} onValue=${set('categoryId')}
          options=${sortCategories(categories).map((c) => ({ value: c.id, label: c.name }))} />
        <${Segmented} label="Urgenza" value=${form.urgency} onValue=${set('urgency')} options=${URGENCIES} />
        <button type="submit" hidden></button>
      </form>`}
    <//>`;
}
