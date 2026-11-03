import { addMonths, daysBetween, endOfMonth, toDateKey } from './dates.js';

/** Gravità crescente: usata per scegliere lo stato peggiore e ordinare i banner. */
export const STATUS_SEVERITY = { unknown: 0, ok: 1, warning: 2, critical: 3, overdue: 4 };

/**
 * Stato di una scadenza con d = giorni di calendario da oggi.
 * ok d>30 · warning 8≤d≤30 · critical 0≤d≤7 · overdue d<0 · unknown data mancante.
 */
export function deadlineStatus(dueDate, today) {
  if (!dueDate) return 'unknown';
  const d = daysBetween(today, dueDate);
  if (d < 0) return 'overdue';
  if (d <= 7) return 'critical';
  if (d <= 30) return 'warning';
  return 'ok';
}

/** Lo stato più grave tra quelli dati (unknown solo se non c'è altro). */
export function worstStatus(...statuses) {
  return statuses.flat().reduce(
    (worst, s) => ((STATUS_SEVERITY[s] ?? 0) > STATUS_SEVERITY[worst] ? s : worst),
    'unknown',
  );
}

/** Giorni mancanti (negativi se scaduta) o null. */
export function daysLeft(dueDate, today) {
  return dueDate ? daysBetween(today, dueDate) : null;
}

/**
 * Porzione di periodo rimanente per l'HudGauge (1 = appena rinnovato, 0 = scaduto).
 * Il periodo parte da dueDate − periodMonths.
 */
export function remainingRatio(dueDate, periodMonths, today) {
  if (!dueDate || !(periodMonths > 0)) return 0;
  const start = addMonths(dueDate, -periodMonths);
  const total = daysBetween(start, dueDate);
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, daysBetween(today, dueDate) / total));
}

/** Mesi di validità di un rinnovo per tipo di scadenza auto. */
export function renewalMonths(deadline) {
  switch (deadline.type) {
    case 'bollo': return 12;
    case 'assicurazione': return deadline.recurrenceMonths === 6 ? 6 : 12;
    case 'revisione': return 24;
    default: return deadline.recurrenceMonths > 0 ? deadline.recurrenceMonths : 12;
  }
}

/** Prima revisione: fine del mese di immatricolazione + 4 anni. */
export function firstRevisionDate(registrationDate) {
  if (!registrationDate) return null;
  return endOfMonth(addMonths(toDateKey(registrationDate), 48));
}

/**
 * Revisione da proporre alla creazione del veicolo: la prima (fine mese di immatricolazione
 * + 4 anni) oppure, se già passata, la successiva ogni 24 mesi che cade da oggi in poi.
 */
export function proposedRevisionDate(registrationDate, today) {
  let due = firstRevisionDate(registrationDate);
  if (!due) return null;
  const todayKey = toDateKey(today);
  while (due < todayKey) due = endOfMonth(addMonths(due, 24));
  return due;
}

/**
 * Nuova scadenza proposta dopo "Segna come rinnovato".
 * bollo +12 mesi · assicurazione +12 (o +6) · revisione: la prima a fine mese di
 * immatricolazione + 4 anni, le successive +24 mesi (sempre a fine mese).
 * @param {{ type: string, dueDate?: string, recurrenceMonths?: number }} deadline
 * @param {{ registrationDate?: string }} [vehicle]
 */
export function proposeRenewal(deadline, vehicle = {}) {
  if (deadline.type === 'revisione') {
    const first = firstRevisionDate(vehicle.registrationDate);
    if (!deadline.dueDate) return first;
    if (first && deadline.dueDate < first) return first;
    return endOfMonth(addMonths(deadline.dueDate, 24));
  }
  if (!deadline.dueDate) return null;
  return addMonths(deadline.dueDate, renewalMonths(deadline));
}

/** Prossima manutenzione di casa: ultima esecuzione + intervallo in mesi. */
export function maintenanceNextDate(item) {
  if (!item.lastDoneDate || !(item.intervalMonths > 0)) return null;
  return addMonths(item.lastDoneDate, item.intervalMonths);
}

const BANNER_STATUSES = new Set(['warning', 'critical', 'overdue']);
const BANNER_HIDE_MS = 24 * 3600 * 1000;

/**
 * Elementi per i banner di Oggi: warning/critical/overdue entro 30 giorni,
 * esclusi quelli nascosti, ordinati per gravità e poi per data.
 * @param {Array<{ key: string, status: string, date: string }>} items
 * @param {{ today: string, now: string|Date, dismissed?: Record<string, string> }} opts
 *   `dismissed`: chiave → istante ISO fino a cui il banner resta nascosto
 */
export function todayBanners(items, { today, now, dismissed = {} }) {
  const nowMs = new Date(now).getTime();
  return items
    .filter((it) => BANNER_STATUSES.has(it.status) && it.date && daysBetween(today, it.date) <= 30)
    .filter((it) => !(dismissed[it.key] && Date.parse(dismissed[it.key]) > nowMs))
    .sort((a, b) => STATUS_SEVERITY[b.status] - STATUS_SEVERITY[a.status] || (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Nasconde un banner per 24 ore e rimuove le voci già scadute. */
export function dismissBanner(dismissed, key, now) {
  const nowMs = new Date(now).getTime();
  const next = {};
  for (const [k, until] of Object.entries(dismissed || {})) if (Date.parse(until) > nowMs) next[k] = until;
  next[key] = new Date(nowMs + BANNER_HIDE_MS).toISOString();
  return next;
}
