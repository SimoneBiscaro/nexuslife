import { addMonths, daysInMonth, makeDateKey, periodKeyOf, toDateKey } from './dates.js';

/** Scadenza della rata di un mese: giorno oltre fine mese → ultimo giorno. */
export function installmentDueDate(dueDay, periodKey) {
  const [y, m] = periodKey.split('-').map(Number);
  const day = Math.min(Math.max(1, Math.trunc(Number(dueDay)) || 1), daysInMonth(y, m));
  return makeDateKey(y, m, day);
}

/**
 * Rate da creare: mese corrente e successivo, se mancano (per periodKey) e se
 * non precedono il mese di inizio contratto. Restituisce i campi, senza id.
 * @param {{ id: string, totalAmount: number, dueDay: number, startDate?: string }} contract
 * @param {Array<{ contractId: string, periodKey: string, deleted?: boolean }>} existing
 */
export function installmentsToCreate(contract, existing, today) {
  const have = new Set(existing
    .filter((i) => !i.deleted && i.contractId === contract.id)
    .map((i) => i.periodKey));
  const startPeriod = contract.startDate ? periodKeyOf(contract.startDate) : null;
  const current = periodKeyOf(today);
  const periods = [current, periodKeyOf(addMonths(`${current}-01`, 1))];
  return periods
    .filter((p) => !have.has(p) && (!startPeriod || p >= startPeriod))
    .map((periodKey) => ({
      contractId: contract.id,
      periodKey,
      dueDate: installmentDueDate(contract.dueDay, periodKey),
      amount: Number(contract.totalAmount) || 0,
      paidAt: null,
    }));
}

/**
 * Stato di un pagamento (rata o bolletta): paid se paidAt; overdue se oggi > dueDate; altrimenti pending.
 * @returns {'paid'|'overdue'|'pending'}
 */
export function paymentStatus(item, today) {
  if (item.paidAt) return 'paid';
  if (item.dueDate && toDateKey(today) > item.dueDate) return 'overdue';
  return 'pending';
}

/** Totale e quota personale di una rata (D5). */
export function installmentShares(installment, contract) {
  const total = Number(installment.amount ?? contract.totalAmount) || 0;
  const personal = Math.min(total, Number(contract.personalShare) || 0);
  return { total, personal, others: Math.round((total - personal) * 100) / 100 };
}
