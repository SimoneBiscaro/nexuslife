import { addMonths, daysBetween } from './dates.js';
import { deadlineStatus, worstStatus } from './deadlines.js';
import { estimateDateForKm } from './mileage.js';

/**
 * Stato dei km rispetto al tagliando.
 * ok <0,85 · warning 0,85–0,95 · critical 0,95–1,0 · overdue >1,0.
 */
export function kmStatus(usedRatio) {
  if (!Number.isFinite(usedRatio)) return 'unknown';
  if (usedRatio > 1) return 'overdue';
  if (usedRatio >= 0.95) return 'critical';
  if (usedRatio >= 0.85) return 'warning';
  return 'ok';
}

/**
 * Tagliando: nextDate = lastServiceDate + intervalMonths; nextKm = lastServiceKm + intervalKm;
 * usedRatio = (currentKm − lastServiceKm) / intervalKm. Stato finale = il più grave tra data e km.
 * @param {{ lastServiceDate?: string, lastServiceKm?: number, serviceIntervalMonths?: number,
 *   serviceIntervalKm?: number, currentKm?: number }} vehicle
 * @param {string} today
 * @param {{ kmPerDay?: number }} [opts] stima km/giorno per prevedere quando si raggiungono i km
 */
export function serviceStatus(vehicle, today, { kmPerDay } = {}) {
  const intervalMonths = Number(vehicle.serviceIntervalMonths ?? 12);
  const intervalKm = Number(vehicle.serviceIntervalKm ?? 15000);
  const hasDate = Boolean(vehicle.lastServiceDate) && intervalMonths > 0;
  const hasKm = Number.isFinite(Number(vehicle.lastServiceKm)) && vehicle.lastServiceKm !== null
    && vehicle.lastServiceKm !== undefined && intervalKm > 0 && Number.isFinite(Number(vehicle.currentKm));

  const nextDate = hasDate ? addMonths(vehicle.lastServiceDate, intervalMonths) : null;
  const dateStatus = deadlineStatus(nextDate, today);

  const nextKm = hasKm ? Number(vehicle.lastServiceKm) + intervalKm : null;
  const usedRatio = hasKm ? (Number(vehicle.currentKm) - Number(vehicle.lastServiceKm)) / intervalKm : null;
  const kmSt = hasKm ? kmStatus(usedRatio) : 'unknown';
  const kmRemaining = hasKm ? nextKm - Number(vehicle.currentKm) : null;
  const estimatedKmDate = hasKm && kmPerDay !== undefined
    ? estimateDateForKm(nextKm, Number(vehicle.currentKm), kmPerDay, today)
    : null;

  // Data effettiva: la prima tra la scadenza a calendario e quella stimata dai km.
  const dueCandidates = [nextDate, estimatedKmDate].filter(Boolean).sort();
  const effectiveDate = dueCandidates[0] ?? null;

  return {
    nextDate,
    nextKm,
    usedRatio,
    kmRemaining,
    daysRemaining: nextDate ? daysBetween(today, nextDate) : null,
    estimatedKmDate,
    effectiveDate,
    dateStatus,
    kmStatus: kmSt,
    status: worstStatus(dateStatus, kmSt),
  };
}

/** Porzione di intervallo km rimanente (1 = appena fatto, 0 = da fare). */
export function serviceKmRemainingRatio(usedRatio) {
  if (!Number.isFinite(usedRatio)) return 0;
  return Math.min(1, Math.max(0, 1 - usedRatio));
}
