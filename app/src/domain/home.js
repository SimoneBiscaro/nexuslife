import { daysBetween, periodKeyOf } from './dates.js';
import { deadlineStatus, maintenanceNextDate } from './deadlines.js';
import { installmentDueDate, paymentStatus } from './rent.js';

export const BILL_KINDS = ['luce', 'gas', 'internet', 'acqua', 'rifiuti', 'altro'];
export const BILL_KIND_LABEL = { luce: 'Luce', gas: 'Gas', internet: 'Internet', acqua: 'Acqua', rifiuti: 'Rifiuti', altro: 'Altro' };
export const PRIORITY_RANK = { alta: 3, media: 2, bassa: 1 };
export const HOME_PURCHASE_CATEGORIES = ['arredamento', 'ferramenta', 'detersivi', 'bricolage', 'altro'];

const live = (list) => (list || []).filter((r) => !r.deleted);
const round2 = (n) => Math.round(n * 100) / 100;

/* ---------- Affitto ---------- */

/** Contratto attivo: il più recente non eliminato. */
export function activeContract(contracts) {
  return live(contracts).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] || null;
}

/** Rate del contratto dalla più recente. */
export function rentHistory(installments, contractId) {
  return live(installments).filter((i) => i.contractId === contractId)
    .sort((a, b) => (a.periodKey < b.periodKey ? 1 : -1));
}

/** Rata del mese di `today`, o null. */
export function currentInstallment(installments, contractId, today) {
  const period = periodKeyOf(today);
  return live(installments).find((i) => i.contractId === contractId && i.periodKey === period) || null;
}

/**
 * Dopo la modifica del contratto: le rate non pagate dal mese corrente in poi
 * seguono il nuovo importo e il nuovo giorno di scadenza.
 * @returns {Array<{ id: string, amount: number, dueDate: string }>}
 */
export function installmentUpdatesForContract(contract, installments, today) {
  const period = periodKeyOf(today);
  return live(installments)
    .filter((i) => i.contractId === contract.id && !i.paidAt && i.periodKey >= period)
    .map((i) => ({ id: i.id, amount: Number(contract.totalAmount) || 0, dueDate: installmentDueDate(contract.dueDay, i.periodKey) }))
    .filter((u) => {
      const i = installments.find((x) => x.id === u.id);
      return i.amount !== u.amount || i.dueDate !== u.dueDate;
    });
}

/** Etichetta e colore dello stato di una rata o bolletta. */
export function paymentBadge(item, today) {
  const s = paymentStatus(item, today);
  if (s === 'paid') return { status: 'ok', label: 'Pagato' };
  if (s === 'overdue') return { status: 'overdue', label: 'In ritardo' };
  const d = daysBetween(today, item.dueDate);
  return { status: d <= 3 ? 'warning' : 'unknown', label: 'In attesa' };
}

/* ---------- Bollette ---------- */

/**
 * Totali delle bollette di un anno (per mese della scadenza).
 * @returns {{ months: number[], byKind: Record<string, number>, matrix: Record<string, number[]>, total: number, unpaid: number }}
 *   matrix: per ogni tipo, i 12 totali mensili (per il grafico impilato)
 */
export function billTotals(bills, year) {
  const months = Array(12).fill(0);
  const byKind = Object.fromEntries(BILL_KINDS.map((k) => [k, 0]));
  const matrix = Object.fromEntries(BILL_KINDS.map((k) => [k, Array(12).fill(0)]));
  let unpaid = 0;
  for (const b of live(bills)) {
    if (!b.dueDate || !b.dueDate.startsWith(`${year}-`)) continue;
    const amount = Number(b.amount) || 0;
    const m = Number(b.dueDate.slice(5, 7)) - 1;
    const kind = BILL_KINDS.includes(b.kind) ? b.kind : 'altro';
    months[m] += amount;
    byKind[kind] += amount;
    matrix[kind][m] += amount;
    if (!b.paidAt) unpaid += amount;
  }
  const total = months.reduce((a, b) => a + b, 0);
  return {
    months: months.map(round2),
    byKind: Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, round2(v)])),
    matrix: Object.fromEntries(Object.entries(matrix).map(([k, v]) => [k, v.map(round2)])),
    total: round2(total),
    unpaid: round2(unpaid),
  };
}

/** Bollette ordinate: non pagate per scadenza, poi pagate dalla più recente. */
export function sortBills(bills) {
  return live(bills).sort((a, b) => {
    if (!a.paidAt !== !b.paidAt) return a.paidAt ? 1 : -1;
    if (!a.paidAt) return a.dueDate < b.dueDate ? -1 : 1;
    return a.dueDate < b.dueDate ? 1 : -1;
  });
}

/* ---------- Manutenzioni ---------- */

/** Prossima esecuzione, stato e giorni mancanti. */
export function maintenanceState(item, today) {
  const nextDate = maintenanceNextDate(item);
  return {
    nextDate,
    status: deadlineStatus(nextDate, today),
    days: nextDate ? daysBetween(today, nextDate) : null,
  };
}

/** Manutenzioni dalla più urgente. */
export function sortMaintenance(items, today) {
  return live(items)
    .map((item) => ({ item, ...maintenanceState(item, today) }))
    .sort((a, b) => {
      if (!a.nextDate !== !b.nextDate) return a.nextDate ? -1 : 1;
      return (a.nextDate || '') < (b.nextDate || '') ? -1 : (a.nextDate || '') > (b.nextDate || '') ? 1 : 0;
    });
}

/* ---------- Da comprare per la casa ---------- */

/** Da fare prima (per priorità, poi nome), fatti in fondo. */
export function sortHomePurchases(items) {
  return live(items).sort((a, b) =>
    (a.done ? 1 : 0) - (b.done ? 1 : 0)
    || (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0)
    || String(a.name).localeCompare(String(b.name), 'it'));
}

/** Totale stimato degli acquisti ancora da fare. */
export function homePurchasesTotal(items) {
  return round2(live(items).filter((i) => !i.done).reduce((sum, i) => sum + (Number(i.estimatedPrice) || 0), 0));
}

