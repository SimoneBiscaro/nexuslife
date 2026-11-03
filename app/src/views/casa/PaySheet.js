import { useEffect, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { Sheet } from '../../ui/Sheet.js';
import { NeonBadge } from '../../ui/NeonBadge.js';
import { TextField } from '../../ui/forms.js';
import { Icon } from '../../ui/icons.js';
import { showToast } from '../../ui/Toast.js';
import { formatEuro, formatLongDate } from '../../ui/format.js';
import { getRepo } from '../../store/repo.js';
import { formatPeriod, isDateKey } from '../../domain/dates.js';
import { installmentShares } from '../../domain/rent.js';
import { paymentBadge } from '../../domain/home.js';

/** Dettaglio di una rata: segna come pagata (con data) o annulla il pagamento. */
export function PaySheet({ installment, contract, today, onClose }) {
  const open = Boolean(installment);
  const [date, setDate] = useState(today);
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setDate(today); setError(''); } }, [installment?.id]);

  async function setPaid(paidAt) {
    if (paidAt && !isDateKey(paidAt)) { setError('Data non valida'); return; }
    const repo = await getRepo();
    const previous = installment.paidAt ?? null;
    await repo.update('rentInstallment', installment.id, { paidAt });
    onClose();
    showToast({
      message: paidAt ? `Affitto di ${formatPeriod(installment.periodKey)} pagato` : 'Pagamento annullato',
      onAction: () => repo.update('rentInstallment', installment.id, { paidAt: previous }),
    });
  }

  if (!open) return html`<${Sheet} open=${false} onClose=${onClose} title="Rata" />`;
  const badge = paymentBadge(installment, today);
  const shares = installmentShares(installment, contract);

  return html`
    <${Sheet} open=${open} onClose=${onClose} title=${`Affitto ${formatPeriod(installment.periodKey)}`}>
      <div class="detail-hero">
        <p class="detail-hero__date">${formatEuro(shares.total)}</p>
        <${NeonBadge} status=${badge.status}>${badge.label}<//>
      </div>
      <dl class="detail-list">
        <div><dt>La tua quota</dt><dd>${formatEuro(shares.personal)}</dd></div>
        <div><dt>Scadenza</dt><dd>${formatLongDate(installment.dueDate)}</dd></div>
        ${installment.paidAt && html`<div class="detail-list__wide"><dt>Pagato il</dt><dd>${formatLongDate(installment.paidAt)}</dd></div>`}
      </dl>
      <div class="renew">
        ${installment.paidAt
          ? html`<button class="btn btn--secondary" type="button" onClick=${() => setPaid(null)}>Segna come non pagato</button>`
          : html`
            <h3 class="renew__title">Segna come pagato</h3>
            <div class="renew__row">
              <${TextField} label="Data del pagamento" type="date" value=${date} max=${today} onValue=${setDate} error=${error} />
              <button class="btn btn--primary" type="button" onClick=${() => setPaid(date)}><${Icon} name="check" /> Pagato</button>
            </div>`}
      </div>
    <//>`;
}
