import { useEffect, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { CalendarButton } from '../../ui/CalendarButton.js';
import { Sheet } from '../../ui/Sheet.js';
import { NeonBadge } from '../../ui/NeonBadge.js';
import { Segmented, TextField } from '../../ui/forms.js';
import { showToast } from '../../ui/Toast.js';
import { haptic } from '../../ui/haptics.js';
import { formatDueDate, parseDecimal } from '../../ui/format.js';
import { getRepo } from '../../store/repo.js';
import { daysLabel } from '../../domain/overview.js';
import { tyreChange, tyreChangePatch, TYRE_LABEL, TYRE_TYPES } from '../../domain/tyres.js';

/**
 * Gomme: tipo montato, prossimo cambio stagionale e "Cambio fatto" (con spesa facoltativa).
 * @param {{ open, onClose, vehicle, today, currentKm }} props
 */
export function TyreSheet({ open, onClose, vehicle, today, currentKm }) {
  const [cost, setCost] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setCost(''); setError(''); } }, [open]);
  const tc = tyreChange(vehicle, today);

  async function setType(tyreType) {
    const repo = await getRepo();
    await repo.update('vehicle', vehicle.id, { tyreType });
  }

  async function changed() {
    const amount = cost.trim() === '' ? null : parseDecimal(cost);
    if (cost.trim() !== '' && (amount === null || amount < 0)) { setError('Importo non valido'); return; }
    const repo = await getRepo();
    const before = { tyreType: vehicle.tyreType ?? null, tyreChangedAt: vehicle.tyreChangedAt ?? null };
    const ops = [{ entity: 'vehicle', id: vehicle.id, patch: tyreChangePatch(vehicle, today) }];
    let expenseId = null;
    if (amount !== null) {
      expenseId = crypto.randomUUID();
      ops.push({ entity: 'vehicleExpense', create: { id: expenseId, vehicleId: vehicle.id, date: today, category: 'gomme', amount,
        km: currentKm || null, description: `Cambio gomme ${TYRE_LABEL[tc.target].toLowerCase()}` } });
    }
    await repo.batch(ops);
    haptic();
    onClose();
    showToast({
      message: `Montate le ${TYRE_LABEL[tc.target].toLowerCase()}`,
      onAction: async () => {
        const undo = [{ entity: 'vehicle', id: vehicle.id, patch: before }];
        if (expenseId) undo.push({ entity: 'vehicleExpense', id: expenseId, patch: { deleted: true } });
        await repo.batch(undo);
      },
    });
  }

  const footer = html`
    <button class="btn btn--secondary" type="button" onClick=${onClose}>Chiudi</button>
    ${tc && html`<button class="btn btn--primary" type="button" onClick=${changed}>Cambio fatto</button>`}`;

  return html`
    <${Sheet} open=${open} onClose=${onClose} title="Gomme" footer=${footer}>
      <${Segmented} label="Montate ora" value=${vehicle.tyreType ?? ''} onValue=${setType}
        options=${TYRE_TYPES.map((t) => ({ value: t, label: TYRE_LABEL[t] }))} />
      ${tc
        ? html`<div class="tyre-next">
            <p class="tyre-next__title">Prossimo cambio: <strong>${TYRE_LABEL[tc.target].toLowerCase()}</strong>
              <${NeonBadge} status=${tc.status}>${daysLabel(tc.days)}<//></p>
            <p class="card-text">Si montano dal ${formatDueDate(tc.from, today).replace(/^(il |l')/, '')} ${tc.days < 0 ? 'ed erano da montare' : 'e vanno montate'} entro ${formatDueDate(tc.due, today)}.
              Sono le date nazionali: alcune province e strade hanno obblighi diversi.</p>
            ${vehicle.tyreChangedAt && html`<p class="card-text">Ultimo cambio ${formatDueDate(vehicle.tyreChangedAt, today)}.</p>`}
            <${TextField} label="Spesa del cambio (€)" value=${cost} onValue=${setCost} error=${error} inputmode="decimal"
              placeholder="facoltativa" hint="Se la indichi, finisce nelle spese dell'auto alla voce Gomme" />
          </div>
          <div class="sheet-actions"><${CalendarButton} uid=${`tyres-${vehicle.id}`} /></div>`
        : html`<p class="card-text tyre-next">${vehicle.tyreType === 'quattroStagioni'
          ? 'Con le quattro stagioni non c\'è un cambio stagionale da ricordare.'
          : 'Indica quali gomme sono montate: ti ricordiamo il cambio tra estive e invernali.'}</p>`}
    <//>`;
}
