import { useEffect, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { Sheet } from '../../ui/Sheet.js';
import { TextField, Segmented } from '../../ui/forms.js';
import { showToast } from '../../ui/Toast.js';
import { parseKm } from '../../ui/format.js';
import { getRepo } from '../../store/repo.js';
import { isDateKey, toDateKey } from '../../domain/dates.js';
import { proposedRevisionDate } from '../../domain/deadlines.js';

const STEPS = ['Veicolo', 'Chilometri e tagliando', 'Scadenze'];

function initialForm(vehicle) {
  return {
    name: vehicle?.name ?? 'T-Cross',
    make: vehicle?.make ?? 'Volkswagen',
    model: vehicle?.model ?? 'T-Cross',
    color: vehicle?.color ?? 'Grigio metallizzato',
    plate: vehicle?.plate ?? '',
    registrationDate: vehicle?.registrationDate ?? '',
    currentKm: vehicle?.currentKm != null ? String(vehicle.currentKm) : '',
    lastServiceDate: vehicle?.lastServiceDate ?? '',
    lastServiceKm: vehicle?.lastServiceKm != null ? String(vehicle.lastServiceKm) : '',
    serviceIntervalKm: String(vehicle?.serviceIntervalKm ?? 15000),
    serviceIntervalMonths: String(vehicle?.serviceIntervalMonths ?? 12),
    bollo: '',
    assicurazione: '',
    assicurazioneMonths: '12',
    revisione: '',
  };
}

/** Errori di validazione del passo indicato (oggetto vuoto se valido). */
function validate(step, f, today) {
  const e = {};
  if (step === 0) {
    if (!f.name.trim()) e.name = 'Dai un nome al veicolo';
    if (f.registrationDate && !isDateKey(f.registrationDate)) e.registrationDate = 'Data non valida';
    else if (f.registrationDate > today) e.registrationDate = 'La data è nel futuro';
  }
  if (step === 1) {
    const km = f.currentKm === '' ? 0 : parseKm(f.currentKm);
    if (km === null) e.currentKm = 'Inserisci solo cifre';
    const last = f.lastServiceKm === '' ? null : parseKm(f.lastServiceKm);
    if (f.lastServiceKm !== '' && last === null) e.lastServiceKm = 'Inserisci solo cifre';
    else if (last !== null && km !== null && last > km) e.lastServiceKm = 'Supera i km attuali';
    if (f.lastServiceDate && f.lastServiceDate > today) e.lastServiceDate = 'La data è nel futuro';
    if (!(parseKm(f.serviceIntervalKm) > 0)) e.serviceIntervalKm = 'Intervallo non valido';
    if (!(parseKm(f.serviceIntervalMonths) > 0)) e.serviceIntervalMonths = 'Intervallo non valido';
  }
  return e;
}

/**
 * Wizard di creazione (3 passi) o modifica (2 passi) del veicolo.
 * @param {{ open: boolean, onClose: () => void, vehicle?: object }} props
 */
export function VehicleWizard({ open, onClose, vehicle }) {
  const editing = Boolean(vehicle);
  const steps = editing ? STEPS.slice(0, 2) : STEPS;
  const today = toDateKey(new Date());
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => initialForm(vehicle));
  const [errors, setErrors] = useState({});
  const [revisionTouched, setRevisionTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(0);
      setForm(initialForm(vehicle));
      setErrors({});
      setRevisionTouched(false);
    }
  }, [open]);

  // Revisione proposta dalla regola del §7 finché l'utente non la modifica.
  useEffect(() => {
    if (!revisionTouched && form.registrationDate && isDateKey(form.registrationDate)) {
      setForm((f) => ({ ...f, revisione: proposedRevisionDate(f.registrationDate, today) }));
    }
  }, [form.registrationDate, revisionTouched]);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const next = () => {
    const e = validate(step, form, today);
    setErrors(e);
    if (Object.keys(e).length) return;
    if (step < steps.length - 1) setStep(step + 1);
    else save();
  };

  async function save() {
    setSaving(true);
    try {
      const repo = await getRepo();
      const fields = {
        name: form.name.trim(),
        make: form.make.trim(),
        model: form.model.trim(),
        color: form.color.trim(),
        plate: form.plate.trim().toUpperCase(),
        registrationDate: form.registrationDate || null,
        currentKm: form.currentKm === '' ? 0 : parseKm(form.currentKm),
        lastServiceDate: form.lastServiceDate || null,
        lastServiceKm: form.lastServiceKm === '' ? null : parseKm(form.lastServiceKm),
        serviceIntervalKm: parseKm(form.serviceIntervalKm),
        serviceIntervalMonths: parseKm(form.serviceIntervalMonths),
      };
      if (editing) {
        await repo.update('vehicle', vehicle.id, fields);
        showToast({ message: 'Veicolo aggiornato' });
      } else {
        const vehicleId = crypto.randomUUID();
        const ops = [{ entity: 'vehicle', create: { id: vehicleId, ...fields, photo: false } }];
        const deadline = (type, dueDate, extra = {}) =>
          dueDate && ops.push({ entity: 'vehicleDeadline', create: { vehicleId, type, dueDate, amount: null, provider: '', notes: '', ...extra } });
        deadline('bollo', form.bollo);
        deadline('assicurazione', form.assicurazione, { recurrenceMonths: Number(form.assicurazioneMonths) });
        deadline('revisione', form.revisione);
        if (fields.currentKm > 0) ops.push({ entity: 'mileageReading', create: { vehicleId, date: today, km: fields.currentKm } });
        await repo.batch(ops);
        showToast({ message: `${fields.name} è nel garage` });
      }
      onClose();
    } catch (err) {
      console.error(err);
      showToast({ message: 'Salvataggio non riuscito', status: 'critical' });
    } finally {
      setSaving(false);
    }
  }

  const last = step === steps.length - 1;
  const footer = html`
    ${step > 0
      ? html`<button class="btn btn--secondary" type="button" onClick=${() => setStep(step - 1)}>Indietro</button>`
      : html`<button class="btn btn--secondary" type="button" onClick=${onClose}>Annulla</button>`}
    <button class="btn btn--primary" type="button" onClick=${next} disabled=${saving}>
      ${last ? (saving ? 'Salvataggio…' : editing ? 'Salva' : 'Aggiungi al garage') : 'Avanti'}
    </button>`;

  return html`
    <${Sheet} open=${open} onClose=${onClose} title=${editing ? 'Modifica veicolo' : 'Nuovo veicolo'} footer=${footer}>
      <ol class="steps" aria-label="Passaggi">
        ${steps.map((s, i) => html`<li key=${s} class=${i === step ? 'is-current' : i < step ? 'is-done' : ''}
          aria-current=${i === step ? 'step' : undefined}><span>${s}</span></li>`)}
      </ol>
      <form class="form-grid" onSubmit=${(e) => { e.preventDefault(); next(); }} noValidate>
        ${step === 0 && html`
          <${TextField} label="Nome" value=${form.name} onValue=${set('name')} error=${errors.name} data-autofocus />
          <${TextField} label="Marca" value=${form.make} onValue=${set('make')} />
          <${TextField} label="Modello" value=${form.model} onValue=${set('model')} />
          <${TextField} label="Colore" value=${form.color} onValue=${set('color')} />
          <${TextField} label="Targa" value=${form.plate} onValue=${set('plate')} autocapitalize="characters" autocomplete="off" placeholder="AB123CD" />
          <${TextField} label="Data di immatricolazione" type="date" value=${form.registrationDate} max=${today}
            onValue=${set('registrationDate')} error=${errors.registrationDate} hint="Serve a calcolare la revisione" />`}
        ${step === 1 && html`
          <${TextField} label="Km attuali" value=${form.currentKm} onValue=${set('currentKm')} error=${errors.currentKm}
            inputmode="numeric" placeholder="0" class="span-2" />
          <${TextField} label="Ultimo tagliando: data" type="date" value=${form.lastServiceDate} max=${today}
            onValue=${set('lastServiceDate')} error=${errors.lastServiceDate} />
          <${TextField} label="Ultimo tagliando: km" value=${form.lastServiceKm} onValue=${set('lastServiceKm')}
            error=${errors.lastServiceKm} inputmode="numeric" />
          <${TextField} label="Intervallo tagliando (km)" value=${form.serviceIntervalKm} onValue=${set('serviceIntervalKm')}
            error=${errors.serviceIntervalKm} inputmode="numeric" />
          <${TextField} label="Intervallo tagliando (mesi)" value=${form.serviceIntervalMonths} onValue=${set('serviceIntervalMonths')}
            error=${errors.serviceIntervalMonths} inputmode="numeric" />`}
        ${step === 2 && html`
          <${TextField} label="Scadenza bollo" type="date" value=${form.bollo} onValue=${set('bollo')} class="span-2" />
          <${TextField} label="Scadenza assicurazione" type="date" value=${form.assicurazione} onValue=${set('assicurazione')} />
          <${Segmented} label="Durata polizza" value=${form.assicurazioneMonths} onValue=${set('assicurazioneMonths')}
            options=${[{ value: '12', label: '12 mesi' }, { value: '6', label: '6 mesi' }]} />
          <${TextField} label="Scadenza revisione" type="date" value=${form.revisione} class="span-2"
            onValue=${(v) => { setRevisionTouched(true); set('revisione')(v); }}
            hint=${form.registrationDate ? 'Proposta dall\'immatricolazione: prima a 4 anni, poi ogni 2 anni' : 'Inserisci l\'immatricolazione per la proposta automatica'} />
          <p class="form-hint span-2">Puoi lasciare vuote le date che non conosci: le aggiungi dopo toccando il relativo indicatore.</p>`}
        <button type="submit" hidden></button>
      </form>
    <//>`;
}
