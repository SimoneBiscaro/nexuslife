import { useEffect, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { Sheet } from '../../ui/Sheet.js';
import { TextField, TextAreaField } from '../../ui/forms.js';
import { showToast } from '../../ui/Toast.js';
import { parseDecimal } from '../../ui/format.js';
import { getRepo } from '../../store/repo.js';
import { ensureRentInstallments } from '../../store/home.js';
import { isDateKey } from '../../domain/dates.js';
import { installmentUpdatesForContract } from '../../domain/home.js';

const toText = (n) => (n != null ? String(n).replace('.', ',') : '');

/** Creazione o modifica del contratto d'affitto (D5: totale e quota personale). */
export function ContractSheet({ open, onClose, contract, installments, today }) {
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  useEffect(() => {
    if (!open) return;
    setForm({
      totalAmount: toText(contract?.totalAmount), personalShare: toText(contract?.personalShare),
      dueDay: String(contract?.dueDay ?? 5), startDate: contract?.startDate ?? `${today.slice(0, 7)}-01`,
      landlord: contract?.landlord ?? '', notes: contract?.notes ?? '',
    });
    setErrors({});
  }, [open]);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    const e = {};
    const total = parseDecimal(form.totalAmount);
    const share = form.personalShare.trim() === '' ? total : parseDecimal(form.personalShare);
    const dueDay = Number(form.dueDay);
    if (!(total > 0)) e.totalAmount = 'Inserisci l\'importo totale';
    if (share === null || share < 0) e.personalShare = 'Quota non valida';
    else if (total > 0 && share > total) e.personalShare = 'Supera il totale';
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) e.dueDay = 'Un giorno da 1 a 31';
    if (!isDateKey(form.startDate)) e.startDate = 'Data non valida';
    setErrors(e);
    if (Object.keys(e).length) return;
    const fields = { totalAmount: total, personalShare: share, dueDay, startDate: form.startDate, landlord: form.landlord.trim(), notes: form.notes.trim() };
    const repo = await getRepo();
    if (contract) {
      const updated = { ...contract, ...fields };
      const changes = installmentUpdatesForContract(updated, installments, today);
      await repo.batch([
        { entity: 'rentContract', id: contract.id, patch: fields },
        ...changes.map((c) => ({ entity: 'rentInstallment', id: c.id, patch: { amount: c.amount, dueDate: c.dueDate } })),
      ]);
      showToast({ message: 'Contratto aggiornato' });
    } else {
      await repo.create('rentContract', fields);
      showToast({ message: 'Affitto impostato' });
    }
    await ensureRentInstallments(repo, today);
    onClose();
  }

  const footer = html`
    <button class="btn btn--secondary" type="button" onClick=${onClose}>${contract ? 'Annulla' : 'Più tardi'}</button>
    <button class="btn btn--primary" type="button" onClick=${save}>Salva</button>`;

  return html`
    <${Sheet} open=${open} onClose=${onClose} title=${contract ? 'Contratto d\'affitto' : 'Imposta l\'affitto'} footer=${footer}>
      ${!contract && html`<p class="card-text sheet-lede">Ogni mese NexusLife prepara la rata e ti ricorda la scadenza.</p>`}
      <form class="form-grid" onSubmit=${(ev) => { ev.preventDefault(); save(); }} noValidate>
        <${TextField} label="Importo totale (€)" value=${form.totalAmount} onValue=${set('totalAmount')} error=${errors.totalAmount}
          inputmode="decimal" placeholder="0,00" data-autofocus />
        <${TextField} label="La tua quota (€)" value=${form.personalShare} onValue=${set('personalShare')} error=${errors.personalShare}
          inputmode="decimal" placeholder="uguale al totale" hint="Se dividi l'affitto con qualcuno" />
        <${TextField} label="Giorno di scadenza" value=${form.dueDay} onValue=${set('dueDay')} error=${errors.dueDay}
          inputmode="numeric" hint="Oltre la fine del mese vale l'ultimo giorno" />
        <${TextField} label="Inizio contratto" type="date" value=${form.startDate} onValue=${set('startDate')} error=${errors.startDate} />
        <${TextField} label="Proprietario (facoltativo)" value=${form.landlord} onValue=${set('landlord')} class="span-2" />
        <div class="span-2"><${TextAreaField} label="Note" value=${form.notes} onValue=${set('notes')} rows=${2} /></div>
        <button type="submit" hidden></button>
      </form>
    <//>`;
}
