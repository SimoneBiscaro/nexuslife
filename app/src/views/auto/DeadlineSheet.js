import { useEffect, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { Sheet } from '../../ui/Sheet.js';
import { NeonBadge } from '../../ui/NeonBadge.js';
import { TextField, TextAreaField, Segmented } from '../../ui/forms.js';
import { showToast } from '../../ui/Toast.js';
import { Icon } from '../../ui/icons.js';
import { formatEuro, formatLongDate, parseDecimal } from '../../ui/format.js';
import { getRepo } from '../../store/repo.js';
import { deadlineStatus, proposeRenewal } from '../../domain/deadlines.js';
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
 * @param {{ open: boolean, onClose: () => void, type: string, record?: object, vehicle: object, today: string }} props
 */
export function DeadlineSheet({ open, onClose, type, record, vehicle, today }) {
  const label = DEADLINE_LABEL[type] ?? type;
  const [editing, setEditing] = useState(!record);
  const [form, setForm] = useState(formFrom(record));
  const [renewDate, setRenewDate] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setEditing(!record);
    setForm(formFrom(record));
    setErrors({});
    setRenewDate((record && proposeRenewal(record, vehicle)) || '');
  }, [open, record?.id, record?.updatedAt]);

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
    if (!isDateKey(renewDate)) {
      setErrors({ renew: 'Data non valida' });
      return;
    }
    const repo = await getRepo();
    const previous = record.dueDate;
    await repo.update('vehicleDeadline', record.id, { dueDate: renewDate });
    onClose();
    showToast({
      message: `${label} rinnovato fino al ${formatLongDate(renewDate)}`,
      onAction: () => repo.update('vehicleDeadline', record.id, { dueDate: previous }),
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
        <div class="renew">
          <h3 class="renew__title">Segna come rinnovato</h3>
          <div class="renew__row">
            <${TextField} label="Nuova scadenza" type="date" value=${renewDate} onValue=${setRenewDate} error=${errors.renew} />
            <button class="btn btn--primary" type="button" onClick=${renew}><${Icon} name="check" /> Rinnovato</button>
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
