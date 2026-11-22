import { useEffect, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { CalendarButton } from '../../ui/CalendarButton.js';
import { Sheet } from '../../ui/Sheet.js';
import { NeonBadge } from '../../ui/NeonBadge.js';
import { TextField } from '../../ui/forms.js';
import { showToast } from '../../ui/Toast.js';
import { Icon } from '../../ui/icons.js';
import { formatInt, formatKm, formatLongDate, parseDecimal, parseKm } from '../../ui/format.js';
import { getRepo } from '../../store/repo.js';
import { daysBetween, isDateKey } from '../../domain/dates.js';
import { daysLabel } from '../../domain/overview.js';
import { STATUS_LABEL } from '../../ui/status.js';
import { clearBookingPatch, proposedDoneDate, bookingSnapshot } from '../../domain/booking.js';
import { BookingForm } from './BookingForm.js';
import { useFocusDone } from './useFocusDone.js';

/**
 * Dettaglio tagliando: prossima data e km, stima, prenotazione, "Tagliando fatto".
 * @param {{ open, onClose, vehicle, overview, today, focus?: 'done' }} props
 */
export function ServiceSheet({ open, onClose, vehicle, overview, today, focus }) {
  const s = overview.service;
  const doneRef = useFocusDone(open && focus === 'done');
  const [date, setDate] = useState(today);
  const [km, setKm] = useState('');
  const [cost, setCost] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setDate(proposedDoneDate(s.booking, today));
    setKm(String(overview.currentKm || ''));
    setCost('');
    setErrors({});
  }, [open]);

  async function done() {
    const e = {};
    const kmValue = parseKm(km);
    const amount = cost.trim() === '' ? null : parseDecimal(cost);
    if (!isDateKey(date) || date > today) e.date = 'Data non valida';
    if (kmValue === null) e.km = 'Inserisci i km del tagliando';
    if (cost.trim() !== '' && (amount === null || amount < 0)) e.cost = 'Importo non valido';
    setErrors(e);
    if (Object.keys(e).length) return;

    const repo = await getRepo();
    const before = { lastServiceDate: vehicle.lastServiceDate ?? null, lastServiceKm: vehicle.lastServiceKm ?? null, currentKm: vehicle.currentKm,
      ...bookingSnapshot(vehicle, 'tagliando') };
    // "Fatto" chiude anche la prenotazione
    const ops = [{ entity: 'vehicle', id: vehicle.id, patch: {
      lastServiceDate: date, lastServiceKm: kmValue, currentKm: Math.max(Number(vehicle.currentKm) || 0, kmValue),
      ...clearBookingPatch('tagliando'),
    } }];
    let expenseId = null;
    if (amount !== null) {
      expenseId = crypto.randomUUID();
      ops.push({ entity: 'vehicleExpense', create: { id: expenseId, vehicleId: vehicle.id, date, category: 'tagliando', amount, km: kmValue, description: 'Tagliando' } });
    }
    await repo.batch(ops);
    onClose();
    showToast({
      message: 'Tagliando registrato',
      onAction: async () => {
        const undo = [{ entity: 'vehicle', id: vehicle.id, patch: before }];
        if (expenseId) undo.push({ entity: 'vehicleExpense', id: expenseId, patch: { deleted: true } });
        await repo.batch(undo);
      },
    });
  }

  const showsKm = s.kmStatus !== 'unknown';
  const orig = s.originalStatus ?? s.status;
  return html`
    <${Sheet} open=${open} onClose=${onClose} title="Tagliando">
      <div class="detail-hero" data-status=${orig}>
        <p class="detail-hero__date">${s.effectiveDate ? formatLongDate(s.effectiveDate) : 'Dati da completare'}</p>
        <${NeonBadge} status=${orig}>${orig === 'unknown' || !s.effectiveDate ? STATUS_LABEL[orig] : daysLabel(daysBetween(today, s.effectiveDate))}<//>
      </div>
      ${s.booking && html`<p class="detail-original">Scadenza originale del tagliando, calcolata come sempre: la prenotazione non la sposta.</p>`}
      <dl class="detail-list">
        <div><dt>Per data</dt><dd>${s.nextDate ? formatLongDate(s.nextDate) : '—'}</dd></div>
        <div><dt>Per km</dt><dd>${s.nextKm != null ? formatKm(s.nextKm) : '—'}</dd></div>
        <div><dt>Km mancanti</dt><dd>${showsKm ? formatKm(s.kmRemaining) : '—'}</dd></div>
        <div><dt>Intervallo usato</dt><dd>${showsKm ? `${formatInt(s.usedRatio * 100)}%` : '—'}</dd></div>
        <div class="detail-list__wide"><dt>Km previsti al tagliando</dt>
          <dd>${s.estimatedKmDate ? formatLongDate(s.estimatedKmDate) : '—'}
            ${s.estimatedKmDate && overview.kmPerDay.generic && html` <span class="tag">stima generica</span>`}</dd></div>
      </dl>
      ${!s.booking && s.effectiveDate && s.effectiveDate >= today && html`<div class="sheet-actions"><${CalendarButton} uid=${`service-${vehicle.id}`} /></div>`}
      <${BookingForm} kind="tagliando" entity="vehicle" record=${vehicle} booking=${s.booking} today=${today} open=${open}
        uid=${`service-${vehicle.id}`} label="Tagliando" />
      <div class="renew" ref=${doneRef}>
        <h3 class="renew__title">Tagliando fatto</h3>
        <form class="form-grid" onSubmit=${(e) => { e.preventDefault(); done(); }} noValidate>
          <${TextField} label="Data" type="date" value=${date} max=${today} onValue=${setDate} error=${errors.date} />
          <${TextField} label="Km" value=${km} onValue=${setKm} error=${errors.km} inputmode="numeric" />
          <${TextField} label="Costo (facoltativo)" value=${cost} onValue=${setCost} error=${errors.cost} inputmode="decimal"
            placeholder="0,00" hint="Se lo indichi, finisce nello storico spese" />
          <div class="form-actions"><button class="btn btn--primary" type="submit"><${Icon} name="check" /> Registra</button></div>
        </form>
      </div>
    <//>`;
}
