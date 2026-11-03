import { useEffect, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { Sheet } from '../../ui/Sheet.js';
import { TextField, SelectField } from '../../ui/forms.js';
import { Icon } from '../../ui/icons.js';
import { showToast } from '../../ui/Toast.js';
import { parseDecimal, parseKm } from '../../ui/format.js';
import { getRepo } from '../../store/repo.js';
import { isDateKey } from '../../domain/dates.js';
import { EXPENSE_CATEGORIES } from './ExpensesCard.js';

const formFrom = (e, today) => ({
  date: e?.date ?? today,
  category: e?.category ?? 'tagliando',
  amount: e?.amount != null ? String(e.amount).replace('.', ',') : '',
  km: e?.km != null ? String(e.km) : '',
  description: e?.description ?? '',
});

/** Aggiunta, modifica ed eliminazione (con Annulla) di una spesa. */
export function ExpenseSheet({ open, onClose, expense, vehicle, today }) {
  const [form, setForm] = useState(formFrom(expense, today));
  const [errors, setErrors] = useState({});
  useEffect(() => {
    if (open) { setForm(formFrom(expense, today)); setErrors({}); }
  }, [open, expense?.id]);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    const e = {};
    const amount = parseDecimal(form.amount);
    const km = form.km.trim() === '' ? null : parseKm(form.km);
    if (!isDateKey(form.date)) e.date = 'Data non valida';
    if (amount === null || amount < 0) e.amount = 'Inserisci l\'importo';
    if (form.km.trim() !== '' && km === null) e.km = 'Solo cifre';
    setErrors(e);
    if (Object.keys(e).length) return;
    const fields = { date: form.date, category: form.category, amount, km, description: form.description.trim() };
    const repo = await getRepo();
    if (expense) await repo.update('vehicleExpense', expense.id, fields);
    else await repo.create('vehicleExpense', { vehicleId: vehicle.id, ...fields });
    showToast({ message: expense ? 'Spesa aggiornata' : 'Spesa aggiunta' });
    onClose();
  }

  async function remove() {
    const repo = await getRepo();
    await repo.softDelete('vehicleExpense', expense.id);
    onClose();
    showToast({ message: 'Spesa eliminata', onAction: () => repo.update('vehicleExpense', expense.id, { deleted: false }) });
  }

  const footer = html`
    ${expense && html`<button class="btn btn--danger footer-start" type="button" onClick=${remove}><${Icon} name="trash" /> Elimina</button>`}
    <button class="btn btn--secondary" type="button" onClick=${onClose}>Annulla</button>
    <button class="btn btn--primary" type="button" onClick=${save}>Salva</button>`;

  return html`
    <${Sheet} open=${open} onClose=${onClose} title=${expense ? 'Modifica spesa' : 'Nuova spesa'} footer=${footer}>
      <form class="form-grid" onSubmit=${(ev) => { ev.preventDefault(); save(); }} noValidate>
        <${TextField} label="Importo (€)" value=${form.amount} onValue=${set('amount')} error=${errors.amount}
          inputmode="decimal" placeholder="0,00" data-autofocus />
        <${SelectField} label="Categoria" value=${form.category} onValue=${set('category')} options=${EXPENSE_CATEGORIES} />
        <${TextField} label="Data" type="date" value=${form.date} onValue=${set('date')} error=${errors.date} />
        <${TextField} label="Km (facoltativo)" value=${form.km} onValue=${set('km')} error=${errors.km} inputmode="numeric" />
        <${TextField} label="Descrizione" value=${form.description} onValue=${set('description')} class="span-2"
          placeholder="Es. cambio pastiglie freni" />
        <button type="submit" hidden></button>
      </form>
    <//>`;
}
