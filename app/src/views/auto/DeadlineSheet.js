import { useEffect, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { CalendarButton } from '../../ui/CalendarButton.js';
import { Sheet } from '../../ui/Sheet.js';
import { NeonBadge } from '../../ui/NeonBadge.js';
import { TextField, TextAreaField, Segmented } from '../../ui/forms.js';
import { showToast } from '../../ui/Toast.js';
import { Icon } from '../../ui/icons.js';
import { formatEuro, formatLongDate, parseDecimal } from '../../ui/format.js';
import { getRepo } from '../../store/repo.js';
import { deadlineStatus, proposeRenewal, proposeRevisionAfter } from '../../domain/deadlines.js';
import { bookingSnapshot, clearBookingPatch, proposedDoneDate, readBooking } from '../../domain/booking.js';
import { BookingForm } from './BookingForm.js';
import { useFocusDone } from './useFocusDone.js';
import { daysBetween, isDateKey } from '../../domain/dates.js';
import { DEADLINE_LABEL, daysLabel } from '../../domain/overview.js';

const formFrom = (r) => ({
  dueDate: r?.dueDate ?? '',
  amount: r?.amount != null ? String(r.amount).replace('.', ',') : '',
  provider: r?.provider ?? '',
  notes: r?.notes ?? '',
  recurrenceMonths: String(r?.recurrenceMonths ?? 12),
});

/**
 * Dettaglio di una scadenza auto (bollo, assicurazione, revisione).
 * Solo la revisione si può prenotare: con una prenotazione "Segna come rinnovato" diventa "Revisione fatta",
 * con la data dell'appuntamento proposta e la nuova scadenza a fine mese + 24 mesi da quella data.
 * @param {{ open: boolean, onClose: () => void, type: string, record?: object, vehicle: object, today: string, focus?: 'done' }} props
 */
export function DeadlineSheet({ open, onClose, type, record, vehicle, today, focus }) {
  const label = DEADLINE_LABEL[type] ?? type;
  const booking = type === 'revisione' ? readBooking(record, 'revisione') : null;
  const [editing, setEditing] = useState(!record);
  const [form, setForm] = useState(formFrom(record));
  const [renewDate, setRenewDate] = useState('');
  const [doneDate, setDoneDate] = useState(today);
  const [errors, setErrors] = useState({});
  const doneRef = useFocusDone(open && focus === 'done' && Boolean(record));

  useEffect(() => {
    if (!open) return;
    setEditing(!record);
    setForm(formFrom(record));
    setErrors({});
    if (booking) {
      const done = proposedDoneDate(booking, today);
      setDoneDate(done);
      setRenewDate(proposeRevisionAfter(done));
    } else {
      setRenewDate((record && proposeRenewal(record, vehicle)) || '');
    }
  }, [open, record?.id, record?.updatedAt]);

  const changeDoneDate = (v) => {
    setDoneDate(v);
    if (isDateKey(v)) setRenewDate(proposeRevisionAfter(v));
  };

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    const e = {};
    if (!isDateKey(form.dueDate)) e.dueDate = 'Inserisci la data di scadenza';
    const amount = form.amount.trim() === '' ? null : parseDecimal(form.amount);
    if (form.amount.trim() !== '' && (amount === null || amount < 0)) e.amount = 'Importo non valido';
    setErrors(e);
    if (Object.keys(e).length) return;
    const fields = {
      dueDate: form.dueDate,
      amount,
      provider: form.provider.trim(),
      notes: form.notes.trim(),
      ...(type === 'assicurazione' ? { recurrenceMonths: Number(form.recurrenceMonths) } : {}),
    };
    const repo = await getRepo();
    if (record) await repo.update('vehicleDeadline', record.id, fields);
    else await repo.create('vehicleDeadline', { vehicleId: vehicle.id, type, ...fields });
    showToast({ message: `${label} salvato` });
    if (record) setEditing(false);
    else onClose();
  }

  async function renew() {
    if (booking && (!isDateKey(doneDate) || doneDate > today)) {
      setErrors({ done: 'Data non valida' });
      return;
    }
    if (!isDateKey(renewDate)) {
      setErrors({ renew: 'Data non valida' });
      return;
    }
    const repo = await getRepo();
    const previous = { dueDate: record.dueDate, ...(booking ? bookingSnapshot(record, 'revisione') : {}) };
    // la revisione fatta chiude anche la prenotazione
    await repo.update('vehicleDeadline', record.id, { dueDate: renewDate, ...(booking ? clearBookingPatch('revisione') : {}) });
    onClose();
    showToast({
      message: booking ? `Revisione registrata: prossima entro il ${formatLongDate(renewDate)}` : `${label} rinnovato fino al ${formatLongDate(renewDate)}`,
      onAction: () => repo.update('vehicleDeadline', record.id, previous),
    });
  }

  const status = record ? deadlineStatus(record.dueDate, today) : 'unknown';
  const days = record?.dueDate ? daysBetween(today, record.dueDate) : null;

  const footer = editing
    ? html`
        <button class="btn btn--secondary" type="button" onClick=${record ? () => setEditing(false) : onClose}>Annulla</button>
        <button class="btn btn--primary" type="button" onClick=${save}>Salva</button>`
    : html`<button class="btn btn--secondary" type="button" onClick=${() => setEditing(true)}><${Icon} name="edit" /> Modifica</button>`;

  return html`
    <${Sheet} open=${open} onClose=${onClose} title=${label} footer=${footer}>
      ${!editing && record && html`
        ${booking && html`<p class="detail-original">Scadenza della revisione (la prenotazione non la sposta):</p>`}
        <div class="detail-hero" data-status=${status}>
          <p class="detail-hero__date">${formatLongDate(record.dueDate)}</p>
          <${NeonBadge} status=${status}>${daysLabel(days)}<//>
        </div>
        <dl class="detail-list">
          <div><dt>Importo</dt><dd>${record.amount != null ? formatEuro(record.amount) : '—'}</dd></div>
          <div><dt>${type === 'assicurazione' ? 'Compagnia' : 'Riferimento'}</dt><dd>${record.provider || '—'}</dd></div>
          ${type === 'assicurazione' && html`<div><dt>Durata</dt><dd>${record.recurrenceMonths === 6 ? '6 mesi' : '12 mesi'}</dd></div>`}
          <div class="detail-list__wide"><dt>Note</dt><dd>${record.notes || '—'}</dd></div>
        </dl>
        ${!booking && record.dueDate >= today && html`<div class="sheet-actions"><${CalendarButton} uid=${`vehicleDeadline-${record.id}`} /></div>`}
        ${type === 'revisione' && html`<${BookingForm} kind="revisione" entity="vehicleDeadline" record=${record} booking=${booking}
          today=${today} open=${open} uid=${`vehicleDeadline-${record.id}`} label="Revisione" />`}
        <div class="renew" ref=${doneRef}>
          <h3 class="renew__title">${booking ? 'Revisione fatta' : 'Segna come rinnovato'}</h3>
          <div class="renew__row">
            ${booking && html`<${TextField} label="Fatta il" type="date" value=${doneDate} max=${today} onValue=${changeDoneDate} error=${errors.done} />`}
            <${TextField} label="Nuova scadenza" type="date" value=${renewDate} onValue=${setRenewDate} error=${errors.renew}
              hint=${booking ? 'Fine mese della revisione + 24 mesi' : undefined} />
            <button class="btn btn--primary" type="button" onClick=${renew}><${Icon} name="check" /> ${booking ? 'Fatta' : 'Rinnovato'}</button>
          </div>
        </div>`}
      ${editing && html`
        <form class="form-grid" onSubmit=${(e) => { e.preventDefault(); save(); }} noValidate>
          <${TextField} label="Scadenza" type="date" value=${form.dueDate} onValue=${set('dueDate')} error=${errors.dueDate} data-autofocus />
          <${TextField} label="Importo (€)" value=${form.amount} onValue=${set('amount')} error=${errors.amount} inputmode="decimal" placeholder="0,00" />
          <${TextField} label=${type === 'assicurazione' ? 'Compagnia' : 'Riferimento'} value=${form.provider} onValue=${set('provider')} />
          ${type === 'assicurazione' && html`<${Segmented} label="Durata polizza" value=${form.recurrenceMonths}
            onValue=${set('recurrenceMonths')} options=${[{ value: '12', label: '12 mesi' }, { value: '6', label: '6 mesi' }]} />`}
          <div class="span-2"><${TextAreaField} label="Note" value=${form.notes} onValue=${set('notes')} /></div>
          <button type="submit" hidden></button>
        </form>`}
    <//>`;
}
