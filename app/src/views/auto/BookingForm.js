import { useEffect, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { CalendarButton } from '../../ui/CalendarButton.js';
import { NeonBadge } from '../../ui/NeonBadge.js';
import { TextField, TextAreaField } from '../../ui/forms.js';
import { showToast } from '../../ui/Toast.js';
import { Icon } from '../../ui/icons.js';
import { haptic } from '../../ui/haptics.js';
import { formatTime, formatWeekdayDate } from '../../ui/format.js';
import { getRepo } from '../../store/repo.js';
import { daysBetween, isDateKey } from '../../domain/dates.js';
import { daysLabel } from '../../domain/overview.js';
import { bookingPatch, bookingSnapshot, bookingState, clearBookingPatch } from '../../domain/booking.js';

const empty = (b, today) => ({ date: b?.date ?? today, time: b?.time ?? '', place: b?.place ?? '', notes: b?.notes ?? '' });

/**
 * Prenotazione di tagliando, revisione o cambio gomme (CLAUDE.md §7):
 * "Segna come prenotato" (data, ora facoltativa, officina, note), modifica e "Annulla prenotazione".
 * Il "Fatto" resta nello Sheet di ciascuna voce, con la data della prenotazione già proposta.
 * @param {{ kind: 'tagliando'|'revisione'|'gomme', entity: string, record: object, booking: object|null,
 *   today: string, uid: string, label: string, open: boolean }} props
 */
export function BookingForm({ kind, entity, record, booking, today, uid, label, open }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(empty(booking, today));
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setEditing(false);
    setErrors({});
    setForm(empty(booking, today));
  }, [open, record?.updatedAt]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const state = bookingState(booking, today);

  async function save() {
    const e = {};
    if (!isDateKey(form.date)) e.date = 'Inserisci la data dell\'appuntamento';
    else if (form.date < today && form.date !== booking?.date) e.date = 'La data è già passata';
    if (form.time && !/^\d{2}:\d{2}$/.test(form.time)) e.time = 'Ora non valida';
    setErrors(e);
    if (Object.keys(e).length) return;
    const repo = await getRepo();
    await repo.update(entity, record.id, bookingPatch(kind, form, today, booking));
    haptic();
    setEditing(false);
    showToast({ message: `${label} prenotato per ${formatWeekdayDate(form.date)}${form.time ? ` alle ${formatTime(form.time)}` : ''}` });
  }

  async function cancel() {
    const repo = await getRepo();
    const before = bookingSnapshot(record, kind);
    await repo.update(entity, record.id, clearBookingPatch(kind));
    haptic();
    showToast({ message: 'Prenotazione annullata', onAction: () => repo.update(entity, record.id, before) });
  }

  if (editing) {
    return html`
      <div class="renew booking">
        <h3 class="renew__title">${booking ? 'Modifica prenotazione' : 'Segna come prenotato'}</h3>
        <form class="form-grid" onSubmit=${(ev) => { ev.preventDefault(); save(); }} noValidate>
          <${TextField} label="Data" type="date" value=${form.date} min=${booking && booking.date < today ? undefined : today}
            onValue=${set('date')} error=${errors.date} data-autofocus />
          <${TextField} label="Ora (facoltativa)" type="time" value=${form.time} onValue=${set('time')} error=${errors.time} />
          <${TextField} label="Officina o luogo" value=${form.place} onValue=${set('place')} placeholder="facoltativo" />
          <div class="span-2"><${TextAreaField} label="Note" value=${form.notes} onValue=${set('notes')} rows=${2} /></div>
          <div class="form-actions span-2">
            <button class="btn btn--secondary" type="button" onClick=${() => { setEditing(false); setForm(empty(booking, today)); }}>Annulla</button>
            <button class="btn btn--primary" type="submit"><${Icon} name="calendar" /> Salva prenotazione</button>
          </div>
        </form>
      </div>`;
  }

  if (!booking) {
    return html`
      <div class="sheet-actions booking">
        <button class="btn btn--secondary" type="button" onClick=${() => setEditing(true)}>
          <${Icon} name="calendar" /> Segna come prenotato
        </button>
      </div>`;
  }

  return html`
    <div class="renew booking" data-status=${state}>
      <h3 class="renew__title">${state === 'booked' ? 'Prenotato' : 'Appuntamento passato'}</h3>
      <div class="booking__card">
        <span class="booking__icon" aria-hidden="true"><${Icon} name="calendar" /></span>
        <div class="booking__main">
          <p class="booking__when">${formatWeekdayDate(booking.date)}${booking.time ? ` · ore ${formatTime(booking.time)}` : ''}</p>
          ${booking.place && html`<p class="booking__meta">${booking.place}</p>`}
          ${booking.notes && html`<p class="booking__meta">${booking.notes}</p>`}
        </div>
        <${NeonBadge} status=${state}>${state === 'booked' ? daysLabel(daysBetween(today, booking.date)) : 'L\'hai fatto?'}<//>
      </div>
      ${state === 'bookingPast' && html`<p class="card-text">Se l'hai fatto, registralo qui sotto con la data dell'appuntamento; altrimenti sposta o annulla la prenotazione.</p>`}
      <div class="sheet-actions">
        <button class="btn btn--secondary" type="button" onClick=${() => setEditing(true)}><${Icon} name="edit" /> ${state === 'bookingPast' ? 'Sposta' : 'Modifica'}</button>
        <button class="btn btn--ghost" type="button" onClick=${cancel}><${Icon} name="close" /> Annulla prenotazione</button>
        ${state === 'booked' && html`<${CalendarButton} uid=${uid} />`}
      </div>
    </div>`;
}
