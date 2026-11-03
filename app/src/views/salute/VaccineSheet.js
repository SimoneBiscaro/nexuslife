import { useEffect, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { Sheet } from '../../ui/Sheet.js';
import { Icon } from '../../ui/icons.js';
import { TextField, TextAreaField } from '../../ui/forms.js';
import { CalendarButton } from '../../ui/CalendarButton.js';
import { showToast } from '../../ui/Toast.js';
import { getRepo } from '../../store/repo.js';
import { isDateKey } from '../../domain/dates.js';

const formFrom = (v, today) => ({ name: v?.name ?? '', date: v?.date ?? today, lot: v?.lot ?? '', boosterDate: v?.boosterDate ?? '', notes: v?.notes ?? '' });

export function VaccineSheet({ open, vaccine, today, onClose }) {
  const [form, setForm] = useState(formFrom(vaccine, today));
  const [errors, setErrors] = useState({});
  useEffect(() => { if (open) { setForm(formFrom(vaccine, today)); setErrors({}); } }, [open, vaccine?.id]);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    const e = {};
    if (!form.name.trim()) e.name = 'Quale vaccino?';
    if (!isDateKey(form.date)) e.date = 'Data non valida';
    if (form.boosterDate && (!isDateKey(form.boosterDate) || form.boosterDate < form.date)) e.boosterDate = 'Il richiamo deve seguire la vaccinazione';
    setErrors(e);
    if (Object.keys(e).length) return;
    const fields = { name: form.name.trim(), date: form.date, lot: form.lot.trim(), boosterDate: form.boosterDate || null, notes: form.notes.trim() };
    const repo = await getRepo();
    if (vaccine) await repo.update('vaccine', vaccine.id, fields);
    else await repo.create('vaccine', fields);
    onClose();
  }

  async function remove() {
    const repo = await getRepo();
    await repo.softDelete('vaccine', vaccine.id);
    onClose();
    showToast({ message: `${vaccine.name} eliminato`, onAction: () => repo.update('vaccine', vaccine.id, { deleted: false }) });
  }

  const footer = html`
    ${vaccine && html`<button class="btn btn--danger footer-start" type="button" onClick=${remove}><${Icon} name="trash" /> Elimina</button>`}
    <button class="btn btn--secondary" type="button" onClick=${onClose}>Annulla</button>
    <button class="btn btn--primary" type="button" onClick=${save}>Salva</button>`;

  return html`
    <${Sheet} open=${open} onClose=${onClose} title=${vaccine ? 'Vaccino' : 'Nuovo vaccino'} footer=${footer}>
      <form class="form-grid" onSubmit=${(e) => { e.preventDefault(); save(); }} noValidate>
        <${TextField} label="Vaccino" value=${form.name} onValue=${set('name')} error=${errors.name} class="span-2" />
        <${TextField} label="Data" type="date" value=${form.date} max=${today} onValue=${set('date')} error=${errors.date} />
        <${TextField} label="Lotto (facoltativo)" value=${form.lot} onValue=${set('lot')} />
        <${TextField} label="Richiamo" type="date" value=${form.boosterDate} onValue=${set('boosterDate')} error=${errors.boosterDate} class="span-2"
          hint="Ti avvisiamo 30 e 7 giorni prima" />
        <div class="span-2"><${TextAreaField} label="Note" value=${form.notes} onValue=${set('notes')} rows=${2} /></div>
        <button type="submit" hidden></button>
      </form>
      ${vaccine?.boosterDate && vaccine.boosterDate >= today && html`<div class="sheet-actions"><${CalendarButton} uid=${`vaccine-${vaccine.id}`} /></div>`}
    <//>`;
}
