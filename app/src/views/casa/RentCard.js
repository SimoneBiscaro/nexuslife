import { html } from '../../ui/html.js';
import { GlassCard } from '../../ui/GlassCard.js';
import { NeonBadge } from '../../ui/NeonBadge.js';
import { Icon } from '../../ui/icons.js';
import { formatDueDate, formatEuro } from '../../ui/format.js';
import { formatPeriod } from '../../domain/dates.js';
import { installmentShares } from '../../domain/rent.js';
import { currentInstallment, paymentBadge, rentHistory } from '../../domain/home.js';

/** Affitto: rata del mese, pagamento, storico rate, modifica contratto. */
export function RentCard({ contract, installments, today, onSetup, onPay }) {
  if (!contract) {
    return html`
      <${GlassCard} class="rent spring-in" style="--i:0">
        <h2 class="card-title">Affitto</h2>
        <p class="card-text">Imposta importo, quota e giorno di scadenza: la rata di ogni mese si prepara da sola.</p>
        <button class="btn btn--primary rent__cta" type="button" onClick=${onSetup}><${Icon} name="plus" /> Imposta l'affitto</button>
      <//>`;
  }
  const current = currentInstallment(installments, contract.id, today);
  const history = rentHistory(installments, contract.id).filter((i) => i.id !== current?.id).slice(0, 12);
  const badge = current && paymentBadge(current, today);
  const shares = current && installmentShares(current, contract);

  return html`
    <${GlassCard} class="rent spring-in" style="--i:0">
      <div class="card-head">
        <div>
          <h2 class="card-title">Affitto</h2>
          <p class="card-text">${current ? formatPeriod(current.periodKey) : 'Nessuna rata questo mese'}</p>
        </div>
        <button class="icon-btn" type="button" onClick=${onSetup} aria-label="Modifica contratto"><${Icon} name="edit" /></button>
      </div>
      ${current && html`
        <div class="rent__now">
          <div>
            <p class="rent__amount num">${formatEuro(shares.total)}</p>
            <p class="card-text">${shares.personal !== shares.total ? `La tua quota ${formatEuro(shares.personal)} · ` : ''}scade ${formatDueDate(current.dueDate, today)}</p>
          </div>
          <${NeonBadge} status=${badge.status}>${badge.label}<//>
        </div>
        ${!current.paidAt && html`<button class="btn btn--primary" type="button" onClick=${() => onPay(current)}><${Icon} name="check" /> Segna come pagato</button>`}`}
      ${history.length > 0 && html`
        <h3 class="subhead">Storico rate</h3>
        <ul class="item-list">
          ${history.map((i) => {
            const b = paymentBadge(i, today);
            return html`<li key=${i.id}>
              <button class="item-row" type="button" onClick=${() => onPay(i)}>
                <span class="item-row__main">
                  <span class="item-row__title">${formatPeriod(i.periodKey)}</span>
                  <span class="item-row__meta">${formatEuro(i.amount)} · scade ${formatDueDate(i.dueDate, today)}</span>
                </span>
                <${NeonBadge} status=${b.status}>${b.label}<//>
              </button></li>`;
          })}
        </ul>`}
    <//>`;
}
