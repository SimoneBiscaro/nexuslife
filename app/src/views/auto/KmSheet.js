import { useEffect, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { Sheet } from '../../ui/Sheet.js';
import { Icon } from '../../ui/icons.js';
import { showToast } from '../../ui/Toast.js';
import { haptic } from '../../ui/haptics.js';
import { formatInt, formatKm } from '../../ui/format.js';
import { getRepo } from '../../store/repo.js';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'];
const MAX_DIGITS = 7;

/**
 * Aggiornamento rapido dei km con tastierino numerico.
 * Un valore inferiore all'ultima lettura chiede conferma.
 * @param {{ open, onClose, vehicle, readings, currentKm, today }} props
 */
export function KmSheet({ open, onClose, vehicle, readings, currentKm, today }) {
  const [digits, setDigits] = useState('');
  const [confirmLower, setConfirmLower] = useState(false);

  useEffect(() => {
    if (open) { setDigits(''); setConfirmLower(false); }
  }, [open]);

  const press = (key) => {
    haptic();
    setConfirmLower(false);
    setDigits((d) => {
      if (key === 'del') return d.slice(0, -1);
      const next = (d + key).replace(/^0+(?=\d)/, '');
      return next.length > MAX_DIGITS ? d : next;
    });
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); press('del'); }
      else if (e.key === 'Enter') { e.preventDefault(); save(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const value = digits === '' ? null : Number(digits);
  const lower = value !== null && value < currentKm;

  async function save() {
    if (value === null || value <= 0) return;
    if (lower && !confirmLower) { setConfirmLower(true); return; }
    const repo = await getRepo();
    const existing = readings.find((r) => r.vehicleId === vehicle.id && r.date === today);
    const previousVehicleKm = vehicle.currentKm;
    let readingId;
    let previousReadingKm = null;
    const ops = [{ entity: 'vehicle', id: vehicle.id, patch: { currentKm: value } }];
    if (existing) {
      readingId = existing.id;
      previousReadingKm = existing.km;
      ops.push({ entity: 'mileageReading', id: existing.id, patch: { km: value } });
    } else {
      readingId = crypto.randomUUID();
      ops.push({ entity: 'mileageReading', create: { id: readingId, vehicleId: vehicle.id, date: today, km: value } });
    }
    await repo.batch(ops);
    onClose();
    showToast({
      message: `Km aggiornati: ${formatKm(value)}`,
      onAction: () => repo.batch([
        { entity: 'vehicle', id: vehicle.id, patch: { currentKm: previousVehicleKm } },
        existing
          ? { entity: 'mileageReading', id: readingId, patch: { km: previousReadingKm } }
          : { entity: 'mileageReading', id: readingId, patch: { deleted: true } },
      ]),
    });
  }

  const footer = html`
    <button class="btn btn--secondary" type="button" onClick=${onClose}>Annulla</button>
    <button class="btn btn--primary" type="button" onClick=${save} disabled=${value === null || value <= 0}>
      ${confirmLower ? 'Salva comunque' : 'Salva'}
    </button>`;

  return html`
    <${Sheet} open=${open} onClose=${onClose} title="Aggiorna chilometri" footer=${footer}>
      <div class="km-display" aria-live="polite">
        <output class=${`km-display__value${digits ? '' : ' is-empty'}`} aria-label="Km inseriti">
          ${digits ? formatInt(value) : formatInt(currentKm)}
        </output>
        <span class="km-display__unit">km</span>
      </div>
      <p class="form-hint km-display__hint">Ultima lettura: ${formatKm(currentKm)}</p>
      ${lower && html`<p class=${`km-warning${confirmLower ? ' is-strong' : ''}`} role="alert">
        Il valore è inferiore all'ultima lettura (${formatKm(currentKm)}). ${confirmLower ? 'Tocca "Salva comunque" per confermare la correzione.' : 'È una correzione?'}
      </p>`}
      <div class="keypad" role="group" aria-label="Tastierino numerico">
        ${KEYS.map((k) => html`
          <button type="button" class="keypad__key" key=${k} onClick=${() => press(k)}
            aria-label=${k === 'del' ? 'Cancella' : k}>
            ${k === 'del' ? html`<${Icon} name="backspace" />` : k}
          </button>`)}
      </div>
    <//>`;
}
