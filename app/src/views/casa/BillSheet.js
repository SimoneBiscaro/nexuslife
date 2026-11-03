import { useEffect, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { CalendarButton } from '../../ui/CalendarButton.js';
import { Sheet } from '../../ui/Sheet.js';
import { Icon } from '../../ui/icons.js';
import { TextField, SelectField, TextAreaField, Segmented } from '../../ui/forms.js';
import { showToast } from '../../ui/Toast.js';
import { parseDecimal } from '../../ui/format.js';
import { getRepo } from '../../store/repo.js';
import { isDateKey } from '../../domain/dates.js';
import { BILL_KINDS, BILL_KIND_LABEL } from '../../domain/home.js';

const formFrom = (b, today) => ({
  kind: b?.kind ?? 'luce', dueDate: b?.dueDate ?? today,
  amount: b?.amount != null ? String(b.amount).replace('.', ',') : '',
  provider: b?.provider ?? '', notes: b?.notes ?? '',
  paid: b?.paidAt ? 'si' : 'no', paidAt: b?.paidAt ?? today,
});

/** Aggiunta, modifica ed eliminazione (con Annulla) di una bolletta. */
export function BillSheet({ open, bill, today, onClose }) {
  const [form, setForm] = useState(formFrom(bill, today));
  const [errors, setErrors] = useState({});
  useEffect(() => { if (open) { setForm(formFrom(bill, today)); setErrors({}); } }, [open, bill?.id]);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    const e = {};
    const amount = parseDecimal(form.amount);
    if (amount === null || amount < 0) e.amount = 'Inserisci l\'importo';
    if (!isDateKey(form.dueDate)) e.dueDate = 'Data non valida';
    if (form.paid === 'si' && !isDateKey(form.paidAt)) e.paidAt = 'Data non valida';
    setErrors(e);
    if (Object.keys(e).length) return;
    const fields = {
      kind: form.kind, dueDate: form.dueDate, amount, provider: form.provider.trim(), notes: form.notes.trim(),
      paidAt: form.paid === 'si' ? form.paidAt : null,
    };
    const repo = await getRepo();
    if (bill) await repo.update('bill', bill.id, fields);
    else await repo.create('bill', fields);
    showToast({ message: bill ? 'Bolletta aggiornata' : 'Bolletta aggiunta' });
    onClose();
  }

  async function remove() {
    const repo = await getRepo();
    await repo.softDelete('bill', bill.id);
    onClose();
    showToast({ message: 'Bolletta eliminata', onAction: () => repo.update('bill', bill.id, { deleted: false }) });
  }

  const footer = html`
    ${bill && html`<button class="btn btn--danger footer-start" type="button" onClick=${remove}><${Icon} name="trash" /> Elimina</button>`}
    <button class="btn btn--secondary" type="button" onClick=${onClose}>Annulla</button>
    <button class="btn btn--primary" type="button" onClick=${save}>Salva</button>`;

  return html`
    <${Sheet} open=${open} onClose=${onClose} title=${bill ? 'Bolletta' : 'Nuova bolletta'} footer=${footer}>
      <form class="form-grid" onSubmit=${(ev) => { ev.preventDefault(); save(); }} noValidate>
        <${SelectField} label="Tipo" value=${form.kind} onValue=${set('kind')} options=${BILL_KINDS.map((k) => ({ value: k, label: BILL_KIND_LABEL[k] }))} />
        <${TextField} label="Importo (€)" value=${form.amount} onValue=${set('amount')} error=${errors.amount} inputmode="decimal" placeholder="0,00" data-autofocus />
        <${TextField} label="Scadenza" type="date" value=${form.dueDate} onValue=${set('dueDate')} error=${errors.dueDate} />
        <${TextField} label="Fornitore" value=${form.provider} onValue=${set('provider')} placeholder="Es. Enel" />
        <${Segmented} label="Stato" value=${form.paid} onValue=${set('paid')} options=${[{ value: 'no', label: 'Da pagare' }, { value: 'si', label: 'Pagata' }]} />
        ${form.paid === 'si' && html`<${TextField} label="Pagata il" type="date" value=${form.paidAt} max=${today} onValue=${set('paidAt')} error=${errors.paidAt} />`}
        <div class="span-2"><${TextAreaField} label="Note" value=${form.notes} onValue=${set('notes')} rows=${2} /></div>
        <button type="submit" hidden></button>
      </form>
      ${bill && !bill.paidAt && bill.dueDate >= today && html`<div class="sheet-actions"><${CalendarButton} uid=${`bill-${bill.id}`} /></div>`}
    <//>`;
}
