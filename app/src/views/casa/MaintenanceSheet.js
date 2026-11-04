import { useEffect, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { CalendarButton } from '../../ui/CalendarButton.js';
import { Sheet } from '../../ui/Sheet.js';
import { Icon } from '../../ui/icons.js';
import { TextField, TextAreaField, Segmented } from '../../ui/forms.js';
import { showToast } from '../../ui/Toast.js';
import { parseKm } from '../../ui/format.js';
import { getRepo } from '../../store/repo.js';
import { isDateKey } from '../../domain/dates.js';
import { isPeriodic } from '../../domain/maintenance.js';
import { maintenanceNextDate } from '../../domain/deadlines.js';

/** Proposte rapide (solo per compilare il modulo). */
const PRESETS = {
  homeMaintenance: [
    { title: 'Caldaia', intervalMonths: 12 },
    { title: 'Filtri condizionatori', intervalMonths: 6 },
    { title: 'Filtro cappa', intervalMonths: 6 },
    { title: 'Pulizia lavatrice', intervalMonths: 3 },
    { title: 'Decalcificare macchina del caffè', intervalMonths: 2 },
    { title: 'Imbiancare', once: true },
  ],
  vehicleMaintenance: [
    { title: 'Cambio olio', intervalMonths: 12, intervalKm: 15000 },
    { title: 'Filtro abitacolo', intervalMonths: 12, intervalKm: 15000 },
    { title: 'Liquido freni', intervalMonths: 24 },
    { title: 'Pastiglie freni', intervalKm: 40000 },
    { title: 'Tergicristalli', intervalMonths: 12 },
    { title: 'Batteria', once: true },
  ],
};

const str = (n) => (n === null || n === undefined || n === '' ? '' : String(n));
const formFrom = (m, entity) => ({
  title: m?.title ?? '',
  mode: m && !isPeriodic(m) ? 'once' : 'periodic',
  intervalMonths: m ? str(m.intervalMonths) : entity === 'homeMaintenance' ? '12' : '',
  intervalKm: str(m?.intervalKm),
  lastDoneDate: m?.lastDoneDate ?? '',
  lastDoneKm: str(m?.lastDoneKm),
  dueDate: m?.dueDate ?? '',
  notes: m?.notes ?? '',
});

/**
 * Manutenzione di casa (`homeMaintenance`) o dell'auto (`vehicleMaintenance`, con km),
 * periodica oppure una tantum.
 * @param {{ open, item, today, onClose, entity?: string, vehicle?: object, currentKm?: number }} props
 */
export function MaintenanceSheet({ open, item, today, onClose, entity = 'homeMaintenance', vehicle, currentKm }) {
  const isAuto = entity === 'vehicleMaintenance';
  const [form, setForm] = useState(formFrom(item, entity));
  const [errors, setErrors] = useState({});
  useEffect(() => { if (open) { setForm(formFrom(item, entity)); setErrors({}); } }, [open, item?.id]);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const periodic = form.mode === 'periodic';

  async function save() {
    const e = {};
    const months = form.intervalMonths.trim() === '' ? null : Number(form.intervalMonths);
    const km = isAuto && form.intervalKm.trim() !== '' ? parseKm(form.intervalKm) : null;
    const lastKm = isAuto && form.lastDoneKm.trim() !== '' ? parseKm(form.lastDoneKm) : null;
    if (!form.title.trim()) e.title = 'Dai un nome';
    if (periodic) {
      if (months !== null && (!Number.isInteger(months) || months < 1 || months > 120)) e.intervalMonths = 'Da 1 a 120 mesi';
      if (isAuto && form.intervalKm.trim() !== '' && (km === null || km < 500 || km > 300000)) e.intervalKm = 'Da 500 a 300.000 km';
      if (months === null && km === null && !e.intervalMonths && !e.intervalKm) e.intervalMonths = isAuto ? 'Indica i mesi, i km o entrambi' : 'Da 1 a 120 mesi';
      if (form.lastDoneDate && (!isDateKey(form.lastDoneDate) || form.lastDoneDate > today)) e.lastDoneDate = 'Data non valida';
      if (isAuto && form.lastDoneKm.trim() !== '' && (lastKm === null || lastKm < 0)) e.lastDoneKm = 'Km non validi';
    } else if (form.dueDate && !isDateKey(form.dueDate)) e.dueDate = 'Data non valida';
    setErrors(e);
    if (Object.keys(e).length) return;
    const fields = periodic
      ? { title: form.title.trim(), intervalMonths: months, lastDoneDate: form.lastDoneDate || null, dueDate: null, doneAt: null, notes: form.notes.trim(),
        ...(isAuto ? { intervalKm: km, lastDoneKm: lastKm } : {}) }
      : { title: form.title.trim(), intervalMonths: null, dueDate: form.dueDate || null, notes: form.notes.trim(),
        ...(isAuto ? { intervalKm: null } : {}) };
    const repo = await getRepo();
    if (item) await repo.update(entity, item.id, fields);
    else await repo.create(entity, { ...fields, ...(isAuto ? { vehicleId: vehicle.id } : {}), ...(periodic ? {} : { doneAt: null }) });
    onClose();
  }

  async function remove() {
    const repo = await getRepo();
    await repo.softDelete(entity, item.id);
    onClose();
    showToast({ message: `${item.title} eliminata`, onAction: () => repo.update(entity, item.id, { deleted: false }) });
  }

  const usePreset = (p) => setForm((f) => ({
    ...f, title: p.title, mode: p.once ? 'once' : 'periodic',
    intervalMonths: str(p.intervalMonths), intervalKm: str(p.intervalKm),
    lastDoneKm: f.lastDoneKm || (isAuto && p.intervalKm && currentKm ? String(currentKm) : f.lastDoneKm),
  }));

  const footer = html`
    ${item && html`<button class="btn btn--danger footer-start" type="button" onClick=${remove}><${Icon} name="trash" /> Elimina</button>`}
    <button class="btn btn--secondary" type="button" onClick=${onClose}>Annulla</button>
    <button class="btn btn--primary" type="button" onClick=${save}>Salva</button>`;
  const hasCalendar = item && (isAuto || maintenanceNextDate(item));

  return html`
    <${Sheet} open=${open} onClose=${onClose} title=${item ? 'Manutenzione' : isAuto ? 'Nuova manutenzione auto' : 'Nuova manutenzione'} footer=${footer}>
      ${!item && html`<div class="chips presets" role="group" aria-label="Proposte">
        ${PRESETS[entity].map((p) => html`<button type="button" class="chip" key=${p.title} onClick=${() => usePreset(p)}>${p.title}</button>`)}
      </div>`}
      <form class="form-grid" onSubmit=${(ev) => { ev.preventDefault(); save(); }} noValidate>
        <${TextField} label="Cosa" value=${form.title} onValue=${set('title')} error=${errors.title} class="span-2" />
        <div class="span-2"><${Segmented} label="Frequenza" value=${form.mode} onValue=${set('mode')}
          options=${[{ value: 'periodic', label: 'Periodica' }, { value: 'once', label: 'Una tantum' }]} /></div>
        ${periodic ? html`
          <${TextField} label="Ogni quanti mesi" value=${form.intervalMonths} onValue=${set('intervalMonths')} error=${errors.intervalMonths}
            inputmode="numeric" placeholder=${isAuto ? 'facoltativo' : undefined} />
          ${isAuto && html`<${TextField} label="Ogni quanti km" value=${form.intervalKm} onValue=${set('intervalKm')} error=${errors.intervalKm}
            inputmode="numeric" placeholder="facoltativo" />`}
          <${TextField} label="Ultima volta" type="date" value=${form.lastDoneDate} max=${today} onValue=${set('lastDoneDate')} error=${errors.lastDoneDate} />
          ${isAuto && html`<${TextField} label="Km dell'ultima volta" value=${form.lastDoneKm} onValue=${set('lastDoneKm')} error=${errors.lastDoneKm}
            inputmode="numeric" placeholder=${currentKm ? `oggi ${currentKm}` : ''} />`}`
        : html`
          <${TextField} label="Entro quando" type="date" value=${form.dueDate} onValue=${set('dueDate')} error=${errors.dueDate}
            hint="Facoltativa" class="span-2" />`}
        <div class="span-2"><${TextAreaField} label="Note" value=${form.notes} onValue=${set('notes')} rows=${2} /></div>
        <button type="submit" hidden></button>
      </form>
      ${hasCalendar && html`<div class="sheet-actions"><${CalendarButton} uid=${`${entity}-${item.id}`} /></div>`}
    <//>`;
}
