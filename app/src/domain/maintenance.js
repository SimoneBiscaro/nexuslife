import { addMonths, daysBetween, toDateKey } from './dates.js';
import { deadlineStatus, STATUS_SEVERITY, worstStatus } from './deadlines.js';
import { estimateDateForKm } from './mileage.js';
import { kmStatus } from './service.js';

/*
 * Manutenzioni di casa e auto.
 * Periodiche: intervalMonths e/o intervalKm (solo auto) a partire dall'ultima esecuzione
 * (lastDoneDate, lastDoneKm). Una tantum: senza intervalli, con dueDate facoltativa e doneAt.
 */

const positive = (n) => Number.isFinite(Number(n)) && Number(n) > 0;
const hasValue = (n) => n !== null && n !== undefined && n !== '' && Number.isFinite(Number(n));

/** true se la manutenzione si ripete (a mesi o a km). */
export function isPeriodic(item) {
  return positive(item?.intervalMonths) || positive(item?.intervalKm);
}

/**
 * Stato di una manutenzione.
 * Periodica: data = ultima + mesi, km = ultimi km + intervallo; stato = il più grave tra data e km
 * (km con le soglie del tagliando). Mai eseguita = unknown ("da fare").
 * Una tantum: fatta = ok e chiusa; altrimenti stato della dueDate, unknown senza data.
 * @param {object} item
 * @param {string} today
 * @param {{ currentKm?: number, kmPerDay?: number }} [opts] solo per le manutenzioni dell'auto
 * @returns {{ periodic: boolean, done: boolean, nextDate: string|null, nextKm: number|null, kmRemaining: number|null,
 *   usedRatio: number|null, dateStatus: string, kmStatus: string, status: string, date: string|null, days: number|null }}
 */
export function maintenancePlan(item, today, { currentKm, kmPerDay } = {}) {
  const key = toDateKey(today);
  if (!isPeriodic(item)) {
    const done = Boolean(item?.doneAt);
    const date = done ? null : item?.dueDate || null;
    const status = done ? 'ok' : deadlineStatus(date, key);
    return { periodic: false, done, nextDate: date, nextKm: null, kmRemaining: null, usedRatio: null,
      dateStatus: status, kmStatus: 'unknown', status, date, days: date ? daysBetween(key, date) : null };
  }
  const nextDate = positive(item.intervalMonths) && item.lastDoneDate ? addMonths(item.lastDoneDate, Number(item.intervalMonths)) : null;
  const dateStatus = deadlineStatus(nextDate, key);
  const hasKm = positive(item.intervalKm) && hasValue(item.lastDoneKm) && hasValue(currentKm);
  const nextKm = hasKm ? Number(item.lastDoneKm) + Number(item.intervalKm) : null;
  const usedRatio = hasKm ? (Number(currentKm) - Number(item.lastDoneKm)) / Number(item.intervalKm) : null;
  const kmSt = hasKm ? kmStatus(usedRatio) : 'unknown';
  const kmRemaining = hasKm ? nextKm - Number(currentKm) : null;
  const kmDate = hasKm && kmPerDay !== undefined ? estimateDateForKm(nextKm, Number(currentKm), kmPerDay, key) : null;
  const date = [nextDate, kmDate].filter(Boolean).sort()[0] ?? null;
  return {
    periodic: true, done: false, nextDate, nextKm, kmRemaining, usedRatio, dateStatus, kmStatus: kmSt,
    status: worstStatus(dateStatus, kmSt), date, days: date ? daysBetween(key, date) : null,
  };
}

/**
 * Manutenzioni dalla più urgente: prima quelle aperte per gravità e data, poi le una tantum fatte.
 * @returns {Array<{ item: object } & ReturnType<typeof maintenancePlan>>}
 */
export function sortMaintenancePlans(items, today, opts = {}) {
  const kmOf = typeof opts.kmFor === 'function' ? opts.kmFor : () => opts;
  // warning, critical e overdue in cima per gravità; ok e senza data alla pari, poi per data.
  const urgency = (s) => (STATUS_SEVERITY[s] >= 2 ? STATUS_SEVERITY[s] : 0);
  return (items || []).filter((r) => !r.deleted)
    .map((item) => ({ item, ...maintenancePlan(item, today, kmOf(item)) }))
    .sort((a, b) => (a.done ? 1 : 0) - (b.done ? 1 : 0)
      || urgency(b.status) - urgency(a.status)
      || (!a.date !== !b.date ? (a.date ? -1 : 1) : 0)
      || String(a.date || '').localeCompare(String(b.date || ''))
      || String(a.item.title || '').localeCompare(String(b.item.title || ''), 'it'));
}

/**
 * Patch per "Fatto": periodica → ultima esecuzione oggi (e km attuali se a km); una tantum → doneAt.
 */
export function markDonePatch(item, today, currentKm) {
  const key = toDateKey(today);
  if (!isPeriodic(item)) return { doneAt: key };
  const patch = { lastDoneDate: key };
  if (positive(item.intervalKm) && hasValue(currentKm)) patch.lastDoneKm = Number(currentKm);
  return patch;
}

/** Descrizione breve della ricorrenza: "ogni 12 mesi o 15.000 km", "una tantum". */
export function recurrenceLabel(item, formatKm = (n) => `${n} km`) {
  if (!isPeriodic(item)) return 'una tantum';
  const parts = [];
  if (positive(item.intervalMonths)) parts.push(`${item.intervalMonths} ${Number(item.intervalMonths) === 1 ? 'mese' : 'mesi'}`);
  if (positive(item.intervalKm)) parts.push(formatKm(Number(item.intervalKm)));
  return `ogni ${parts.join(' o ')}`;
}
