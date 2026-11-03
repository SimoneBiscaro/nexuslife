import { useEffect, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
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

/**
 * Dettaglio tagliando: prossima data e km, stima, "Tagliando fatto".
 * @param {{ open, onClose, vehicle, overview, today }} props
 */
export function ServiceSheet({ open, onClose, vehicle, overview, today }) {
  const s = overview.service;
  const [date, setDate] = useState(today);
  const [km, setKm] = useState('');
  const [cost, setCost] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setDate(today);
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
    const before = { lastServiceDate: vehicle.lastServiceDate ?? null, lastServiceKm: vehicle.lastServiceKm ?? null, currentKm: vehicle.currentKm };
    const ops = [{ entity: 'vehicle', id: vehicle.id, patch: {
      lastServiceDate: date, lastServiceKm: kmValue, currentKm: Math.max(Number(vehicle.currentKm) || 0, kmValue),
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
  return html`
    <${Sheet} open=${open} onClose=${onClose} title="Tagliando">
      <div class="detail-hero" data-status=${s.status}>
        <p class="detail-hero__date">${s.effectiveDate ? formatLongDate(s.effectiveDate) : 'Dati da completare'}</p>
        <${NeonBadge} status=${s.status}>${s.status === 'unknown' || !s.effectiveDate ? STATUS_LABEL[s.status] : daysLabel(daysBetween(today, s.effectiveDate))}<//>
      </div>
      <dl class="detail-list">
        <div><dt>Per data</dt><dd>${s.nextDate ? formatLongDate(s.nextDate) : '—'}</dd></div>
        <div><dt>Per km</dt><dd>${s.nextKm != null ? formatKm(s.nextKm) : '—'}</dd></div>
        <div><dt>Km mancanti</dt><dd>${showsKm ? formatKm(s.kmRemaining) : '—'}</dd></div>
        <div><dt>Intervallo usato</dt><dd>${showsKm ? `${formatInt(s.usedRatio * 100)}%` : '—'}</dd></div>
        <div class="detail-list__wide"><dt>Km previsti al tagliando</dt>
          <dd>${s.estimatedKmDate ? formatLongDate(s.estimatedKmDate) : '—'}
            ${s.estimatedKmDate && overview.kmPerDay.generic && html` <span class="tag">stima generica</span>`}</dd></div>
      </dl>
      <div class="renew">
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
