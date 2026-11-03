import { useEffect, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { Sheet } from '../../ui/Sheet.js';
import { Icon } from '../../ui/icons.js';
import { TextField, SelectField, TextAreaField } from '../../ui/forms.js';
import { CalendarButton } from '../../ui/CalendarButton.js';
import { showToast } from '../../ui/Toast.js';
import { getRepo } from '../../store/repo.js';
import { VISIT_TYPES } from '../../domain/health.js';

const pad = (n) => String(n).padStart(2, '0');
/** ISO → valore di <input type="datetime-local"> nell'ora del dispositivo. */
export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const fromLocalInput = (value) => (value ? new Date(value).toISOString() : null);

const formFrom = (v) => ({
  type: v?.type ?? 'dentista', dateTime: toLocalInput(v?.dateTime), doctor: v?.doctor ?? '', place: v?.place ?? '',
  notes: v?.notes ?? '', postNotes: v?.postNotes ?? '',
});

export function VisitSheet({ open, visit, onClose }) {
  const [form, setForm] = useState(formFrom(visit));
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setForm(formFrom(visit)); setError(''); } }, [open, visit?.id]);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const isPast = visit && Date.parse(visit.dateTime) < Date.now();

  async function save() {
    const dateTime = fromLocalInput(form.dateTime);
    if (!dateTime || !Number.isFinite(Date.parse(dateTime))) { setError('Indica data e ora'); return; }
    const fields = { type: form.type, dateTime, doctor: form.doctor.trim(), place: form.place.trim(), notes: form.notes.trim(), postNotes: form.postNotes.trim() };
    const repo = await getRepo();
    if (visit) await repo.update('medicalVisit', visit.id, fields);
    else await repo.create('medicalVisit', fields);
    showToast({ message: visit ? 'Visita aggiornata' : 'Visita aggiunta' });
    onClose();
  }

  async function remove() {
    const repo = await getRepo();
    await repo.softDelete('medicalVisit', visit.id);
    onClose();
    showToast({ message: 'Visita eliminata', onAction: () => repo.update('medicalVisit', visit.id, { deleted: false }) });
  }

  const footer = html`
    ${visit && html`<button class="btn btn--danger footer-start" type="button" onClick=${remove}><${Icon} name="trash" /> Elimina</button>`}
    <button class="btn btn--secondary" type="button" onClick=${onClose}>Annulla</button>
    <button class="btn btn--primary" type="button" onClick=${save}>Salva</button>`;

  return html`
    <${Sheet} open=${open} onClose=${onClose} title=${visit ? 'Visita' : 'Nuova visita'} footer=${footer}>
      <form class="form-grid" onSubmit=${(e) => { e.preventDefault(); save(); }} noValidate>
        <${SelectField} label="Tipo" value=${form.type} onValue=${set('type')}
          options=${VISIT_TYPES.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))} />
        <${TextField} label="Data e ora" type="datetime-local" value=${form.dateTime} onValue=${set('dateTime')} error=${error} />
        <${TextField} label="Medico" value=${form.doctor} onValue=${set('doctor')} />
        <${TextField} label="Struttura" value=${form.place} onValue=${set('place')} />
        <div class="span-2"><${TextAreaField} label="Note prima della visita" value=${form.notes} onValue=${set('notes')} rows=${2}
          hint="Domande da fare, documenti da portare" /></div>
        <div class="span-2"><${TextAreaField} label="Note dopo la visita" value=${form.postNotes} onValue=${set('postNotes')} rows=${3}
          hint=${isPast ? 'Esito, prescrizioni, prossimo controllo' : 'Da compilare dopo la visita'} /></div>
        <button type="submit" hidden></button>
      </form>
      ${visit && !isPast && html`<div class="sheet-actions"><${CalendarButton} uid=${`medicalVisit-${visit.id}`} /></div>`}
    <//>`;
}
