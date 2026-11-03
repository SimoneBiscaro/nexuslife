import { useEffect, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { Sheet } from '../../ui/Sheet.js';
import { Icon } from '../../ui/icons.js';
import { TextField, TextAreaField } from '../../ui/forms.js';
import { showToast } from '../../ui/Toast.js';
import { getRepo } from '../../store/repo.js';
import { isDateKey } from '../../domain/dates.js';

/** Proposte rapide per una nuova manutenzione (solo per compilare il modulo). */
const PRESETS = [
  { title: 'Caldaia', intervalMonths: 12 },
  { title: 'Filtri condizionatori', intervalMonths: 6 },
  { title: 'Filtro cappa', intervalMonths: 6 },
  { title: 'Pulizia lavatrice', intervalMonths: 3 },
  { title: 'Decalcificare macchina del caffè', intervalMonths: 2 },
];

const formFrom = (m) => ({ title: m?.title ?? '', intervalMonths: String(m?.intervalMonths ?? 12), lastDoneDate: m?.lastDoneDate ?? '', notes: m?.notes ?? '' });

export function MaintenanceSheet({ open, item, today, onClose }) {
  const [form, setForm] = useState(formFrom(item));
  const [errors, setErrors] = useState({});
  useEffect(() => { if (open) { setForm(formFrom(item)); setErrors({}); } }, [open, item?.id]);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    const e = {};
    const months = Number(form.intervalMonths);
    if (!form.title.trim()) e.title = 'Dai un nome';
    if (!Number.isInteger(months) || months < 1 || months > 120) e.intervalMonths = 'Da 1 a 120 mesi';
    if (form.lastDoneDate && (!isDateKey(form.lastDoneDate) || form.lastDoneDate > today)) e.lastDoneDate = 'Data non valida';
    setErrors(e);
    if (Object.keys(e).length) return;
    const fields = { title: form.title.trim(), intervalMonths: months, lastDoneDate: form.lastDoneDate || null, notes: form.notes.trim() };
    const repo = await getRepo();
    if (item) await repo.update('homeMaintenance', item.id, fields);
    else await repo.create('homeMaintenance', fields);
    onClose();
  }

  async function remove() {
    const repo = await getRepo();
    await repo.softDelete('homeMaintenance', item.id);
    onClose();
    showToast({ message: `${item.title} eliminata`, onAction: () => repo.update('homeMaintenance', item.id, { deleted: false }) });
  }

  const footer = html`
    ${item && html`<button class="btn btn--danger footer-start" type="button" onClick=${remove}><${Icon} name="trash" /> Elimina</button>`}
    <button class="btn btn--secondary" type="button" onClick=${onClose}>Annulla</button>
    <button class="btn btn--primary" type="button" onClick=${save}>Salva</button>`;

  return html`
    <${Sheet} open=${open} onClose=${onClose} title=${item ? 'Manutenzione' : 'Nuova manutenzione'} footer=${footer}>
      ${!item && html`<div class="chips presets" role="group" aria-label="Proposte">
        ${PRESETS.map((p) => html`<button type="button" class="chip" key=${p.title}
          onClick=${() => setForm((f) => ({ ...f, title: p.title, intervalMonths: String(p.intervalMonths) }))}>${p.title}</button>`)}
      </div>`}
      <form class="form-grid" onSubmit=${(ev) => { ev.preventDefault(); save(); }} noValidate>
        <${TextField} label="Cosa" value=${form.title} onValue=${set('title')} error=${errors.title} class="span-2" />
        <${TextField} label="Ogni quanti mesi" value=${form.intervalMonths} onValue=${set('intervalMonths')} error=${errors.intervalMonths} inputmode="numeric" />
        <${TextField} label="Ultima volta" type="date" value=${form.lastDoneDate} max=${today} onValue=${set('lastDoneDate')} error=${errors.lastDoneDate} />
        <div class="span-2"><${TextAreaField} label="Note" value=${form.notes} onValue=${set('notes')} rows=${2} /></div>
        <button type="submit" hidden></button>
      </form>
    <//>`;
}
