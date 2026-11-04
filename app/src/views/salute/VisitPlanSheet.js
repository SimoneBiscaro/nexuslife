import { useEffect, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { Sheet } from '../../ui/Sheet.js';
import { Icon } from '../../ui/icons.js';
import { TextField, SelectField, TextAreaField, Segmented } from '../../ui/forms.js';
import { CalendarButton } from '../../ui/CalendarButton.js';
import { showToast } from '../../ui/Toast.js';
import { getRepo } from '../../store/repo.js';
import { isDateKey } from '../../domain/dates.js';
import { VISIT_TYPES } from '../../domain/health.js';

const formFrom = (p) => ({
  type: p?.type ?? 'dentista', doctor: p?.doctor ?? '', mode: Number(p?.intervalMonths) > 0 ? 'periodic' : 'once',
  intervalMonths: p?.intervalMonths ? String(p.intervalMonths) : '12', dueBy: p?.dueBy ?? '', notes: p?.notes ?? '',
});

/**
 * Visita da prenotare: singola o periodica. "Prenota" apre la nuova visita già collegata.
 * @param {{ open, plan, state?: object, today, onClose, onBook: (plan) => void }} props
 */
export function VisitPlanSheet({ open, plan, state, today, onClose, onBook }) {
  const [form, setForm] = useState(formFrom(plan));
  const [errors, setErrors] = useState({});
  useEffect(() => { if (open) { setForm(formFrom(plan)); setErrors({}); } }, [open, plan?.id]);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const periodic = form.mode === 'periodic';

  async function persist() {
    const e = {};
    const months = Number(form.intervalMonths);
    if (periodic && (!Number.isInteger(months) || months < 1 || months > 120)) e.intervalMonths = 'Da 1 a 120 mesi';
    if (form.dueBy && !isDateKey(form.dueBy)) e.dueBy = 'Data non valida';
    setErrors(e);
    if (Object.keys(e).length) return null;
    const fields = { type: form.type, doctor: form.doctor.trim(), intervalMonths: periodic ? months : null, dueBy: form.dueBy || null, notes: form.notes.trim() };
    const repo = await getRepo();
    if (plan) { await repo.update('visitPlan', plan.id, fields); return { ...plan, ...fields }; }
    return repo.create('visitPlan', { ...fields, doneAt: null });
  }

  async function save() {
    if (await persist()) { showToast({ message: plan ? 'Visita da prenotare aggiornata' : 'Aggiunta alle visite da prenotare' }); onClose(); }
  }

  async function book() {
    const saved = await persist();
    if (saved) onBook(saved);
  }

  async function markDone() {
    const repo = await getRepo();
    await repo.update('visitPlan', plan.id, { doneAt: today });
    onClose();
    showToast({ message: 'Segnata come fatta', onAction: () => repo.update('visitPlan', plan.id, { doneAt: null }) });
  }

  async function remove() {
    const repo = await getRepo();
    await repo.softDelete('visitPlan', plan.id);
    onClose();
    showToast({ message: 'Visita da prenotare eliminata', onAction: () => repo.update('visitPlan', plan.id, { deleted: false }) });
  }

  const booked = state?.state === 'prenotata';
  const footer = html`
    ${plan && html`<button class="btn btn--danger footer-start" type="button" onClick=${remove}><${Icon} name="trash" /> Elimina</button>`}
    <button class="btn btn--secondary" type="button" onClick=${save}>Salva</button>
    ${!booked && html`<button class="btn btn--primary" type="button" onClick=${book}><${Icon} name="calendar" /> Prenota</button>`}`;

  return html`
    <${Sheet} open=${open} onClose=${onClose} title=${plan ? 'Visita da prenotare' : 'Nuova visita da prenotare'} footer=${footer}>
      <form class="form-grid" onSubmit=${(ev) => { ev.preventDefault(); save(); }} noValidate>
        <${SelectField} label="Tipo" value=${form.type} onValue=${set('type')}
          options=${VISIT_TYPES.map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1) }))} />
        <${TextField} label="Medico" value=${form.doctor} onValue=${set('doctor')} placeholder="facoltativo" />
        <div class="span-2"><${Segmented} label="Frequenza" value=${form.mode} onValue=${set('mode')}
          options=${[{ value: 'once', label: 'Una volta' }, { value: 'periodic', label: 'Periodica' }]} /></div>
        ${periodic && html`<${TextField} label="Ogni quanti mesi" value=${form.intervalMonths} onValue=${set('intervalMonths')}
          error=${errors.intervalMonths} inputmode="numeric" />`}
        <${TextField} label=${periodic ? 'Prima scadenza' : 'Entro quando'} type="date" value=${form.dueBy} onValue=${set('dueBy')}
          error=${errors.dueBy} hint=${periodic ? 'Poi si calcola dall\'ultima visita' : 'Facoltativa'} class=${periodic ? '' : 'span-2'} />
        <div class="span-2"><${TextAreaField} label="Note" value=${form.notes} onValue=${set('notes')} rows=${2}
          hint="Impegnativa, numero da chiamare, orari" /></div>
        <button type="submit" hidden></button>
      </form>
      ${plan && html`<div class="sheet-actions">
        ${state?.state === 'daPrenotare' && state.dueBy && html`<${CalendarButton} uid=${`visitPlan-${plan.id}`} />`}
        ${!periodic && !booked && html`<button class="btn btn--secondary" type="button" onClick=${markDone}><${Icon} name="check" /> Già fatta</button>`}
      </div>`}
    <//>`;
}
