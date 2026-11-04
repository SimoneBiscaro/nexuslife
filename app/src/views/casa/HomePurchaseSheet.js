import { useEffect, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { Sheet } from '../../ui/Sheet.js';
import { Icon } from '../../ui/icons.js';
import { TextField, SelectField, Segmented } from '../../ui/forms.js';
import { showToast } from '../../ui/Toast.js';
import { parseDecimal } from '../../ui/format.js';
import { getRepo } from '../../store/repo.js';
import { HP_CATEGORY_LABEL, PURCHASE_KINDS } from './HomePurchasesCard.js';

const formFrom = (i, kind) => ({
  name: i?.name ?? '', category: i?.category ?? kind.categories[0], priority: i?.priority ?? 'media',
  estimatedPrice: i?.estimatedPrice != null ? String(i.estimatedPrice).replace('.', ',') : '',
});

/**
 * Acquisto per la casa (`homePurchase`) o per l'auto (`vehiclePurchase`, con vehicleId).
 * @param {{ open, item, onClose, entity?: string, vehicle?: object }} props
 */
export function HomePurchaseSheet({ open, item, onClose, entity = 'homePurchase', vehicle }) {
  const kind = PURCHASE_KINDS[entity];
  const [form, setForm] = useState(formFrom(item, kind));
  const [errors, setErrors] = useState({});
  useEffect(() => { if (open) { setForm(formFrom(item, kind)); setErrors({}); } }, [open, item?.id]);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    const e = {};
    const price = form.estimatedPrice.trim() === '' ? null : parseDecimal(form.estimatedPrice);
    if (!form.name.trim()) e.name = 'Cosa serve?';
    if (form.estimatedPrice.trim() !== '' && (price === null || price < 0)) e.estimatedPrice = 'Prezzo non valido';
    setErrors(e);
    if (Object.keys(e).length) return;
    const fields = { name: form.name.trim(), category: form.category, priority: form.priority, estimatedPrice: price };
    const repo = await getRepo();
    if (item) await repo.update(entity, item.id, fields);
    else await repo.create(entity, { ...fields, done: false, ...(vehicle ? { vehicleId: vehicle.id } : {}) });
    onClose();
  }

  async function remove() {
    const repo = await getRepo();
    await repo.softDelete(entity, item.id);
    onClose();
    showToast({ message: `${item.name} eliminato`, onAction: () => repo.update(entity, item.id, { deleted: false }) });
  }

  const footer = html`
    ${item && html`<button class="btn btn--danger footer-start" type="button" onClick=${remove}><${Icon} name="trash" /> Elimina</button>`}
    <button class="btn btn--secondary" type="button" onClick=${onClose}>Annulla</button>
    <button class="btn btn--primary" type="button" onClick=${save}>Salva</button>`;

  return html`
    <${Sheet} open=${open} onClose=${onClose} title=${item ? 'Da comprare' : kind.sheetTitle} footer=${footer}>
      <form class="form-grid" onSubmit=${(ev) => { ev.preventDefault(); save(); }} noValidate>
        <${TextField} label="Cosa" value=${form.name} onValue=${set('name')} error=${errors.name} class="span-2" data-autofocus />
        <${SelectField} label="Categoria" value=${form.category} onValue=${set('category')}
          options=${kind.categories.map((c) => ({ value: c, label: HP_CATEGORY_LABEL[c] }))} />
        <${TextField} label="Prezzo stimato (€)" value=${form.estimatedPrice} onValue=${set('estimatedPrice')} error=${errors.estimatedPrice}
          inputmode="decimal" placeholder="facoltativo" />
        <div class="span-2"><${Segmented} label="Priorità" value=${form.priority} onValue=${set('priority')}
          options=${[{ value: 'alta', label: 'Alta' }, { value: 'media', label: 'Media' }, { value: 'bassa', label: 'Bassa' }]} /></div>
        <button type="submit" hidden></button>
      </form>
    <//>`;
}
