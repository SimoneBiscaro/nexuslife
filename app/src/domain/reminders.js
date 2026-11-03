import { addDays, formatPeriod, toDateKey, zonedTimeToUtc, TIME_ZONE } from './dates.js';
import { maintenanceNextDate } from './deadlines.js';
import { serviceStatus } from './service.js';
import { estimateKmPerDay, latestKm } from './mileage.js';

/** Preavvisi per tipo: giorni prima (alle `reminderHour`) oppure ore prima (visite). */
export const REMINDER_RULES = {
  auto: { days: [30, 7, 1, 0] },
  rent: { days: [3, 0] },
  bill: { days: [3, 0] },
  homeMaintenance: { days: [7] },
  medicalVisit: { hours: [24, 2] },
  vaccine: { days: [30, 7] },
};

const DEADLINE_LABEL = { bollo: 'Bollo', assicurazione: 'Assicurazione', revisione: 'Revisione' };
const BILL_LABEL = { luce: 'luce', gas: 'gas', internet: 'internet', acqua: 'acqua', rifiuti: 'rifiuti', altro: '' };

function leadLabel(days, hours) {
  if (hours !== undefined) return `${hours} ore prima`;
  if (days === 0) return 'il giorno stesso';
  if (days === 1) return '1 giorno prima';
  return `${days} giorni prima`;
}

/**
 * Istanti dei preavvisi di un evento.
 * Eventi a data (scadenze): ogni preavviso è alle `reminderHour`:00 ora di Roma, N giorni prima.
 * Eventi a orario (visite): N ore prima dell'inizio.
 * @param {{ kind: keyof REMINDER_RULES, date?: string, dateTime?: string }} event
 * @returns {Array<{ label: string, at: string, minutesBefore: number }>}
 */
export function reminderTimes(event, { reminderHour = 9, timeZone = TIME_ZONE } = {}) {
  const rule = REMINDER_RULES[event.kind];
  if (!rule) return [];
  if (rule.hours) {
    if (!event.dateTime) return [];
    const start = Date.parse(event.dateTime);
    return rule.hours.map((h) => ({
      label: leadLabel(undefined, h),
      at: new Date(start - h * 3_600_000).toISOString(),
      minutesBefore: h * 60,
    }));
  }
  if (!event.date) return [];
  const start = zonedTimeToUtc(event.date, reminderHour, 0, timeZone).getTime();
  return rule.days.map((d) => {
    const at = zonedTimeToUtc(addDays(event.date, -d), reminderHour, 0, timeZone).getTime();
    return { label: leadLabel(d), at: new Date(at).toISOString(), minutesBefore: Math.round((start - at) / 60_000) };
  });
}

const live = (list) => (list || []).filter((r) => !r.deleted);

/**
 * Eventi da esportare nel calendario con i loro preavvisi, da oggi in poi.
 * @param {{ vehicles?, vehicleDeadlines?, mileageReadings?, rentInstallments?, bills?, homeMaintenance?,
 *   medicalVisits?, vaccines? }} data liste di record
 * @param {{ today: string, reminderHour?: number }} opts
 * @returns {Array<{ uid: string, kind: string, title: string, date?: string, dateTime?: string, reminders: Array }>}
 */
export function buildReminderEvents(data, { today, reminderHour = 9 }) {
  const todayKey = toDateKey(today);
  const events = [];
  const vehicles = new Map(live(data.vehicles).map((v) => [v.id, v]));
  const vName = (id) => vehicles.get(id)?.name || vehicles.get(id)?.model || 'auto';

  for (const d of live(data.vehicleDeadlines)) {
    if (!d.dueDate) continue;
    events.push({ uid: `vehicleDeadline-${d.id}`, kind: 'auto', title: `${DEADLINE_LABEL[d.type] ?? d.type} – ${vName(d.vehicleId)}`, date: d.dueDate });
  }
  for (const v of vehicles.values()) {
    const readings = live(data.mileageReadings).filter((r) => r.vehicleId === v.id);
    const km = estimateKmPerDay(readings, todayKey).kmPerDay;
    const s = serviceStatus({ ...v, currentKm: latestKm(v, readings) }, todayKey, { kmPerDay: km });
    if (s.effectiveDate) events.push({ uid: `service-${v.id}`, kind: 'auto', title: `Tagliando – ${vName(v.id)}`, date: s.effectiveDate });
  }
  for (const r of live(data.rentInstallments)) {
    if (r.paidAt || !r.dueDate) continue;
    events.push({ uid: `rentInstallment-${r.id}`, kind: 'rent', title: `Affitto ${formatPeriod(r.periodKey)}`, date: r.dueDate });
  }
  for (const b of live(data.bills)) {
    if (b.paidAt || !b.dueDate) continue;
    const kind = BILL_LABEL[b.kind] ?? b.kind ?? '';
    events.push({ uid: `bill-${b.id}`, kind: 'bill', title: `Bolletta ${kind}`.trim(), date: b.dueDate });
  }
  for (const m of live(data.homeMaintenance)) {
    const next = maintenanceNextDate(m);
    if (next) events.push({ uid: `homeMaintenance-${m.id}`, kind: 'homeMaintenance', title: `Manutenzione: ${m.title}`, date: next });
  }
  for (const v of live(data.medicalVisits)) {
    if (!v.dateTime) continue;
    events.push({ uid: `medicalVisit-${v.id}`, kind: 'medicalVisit', title: `Visita: ${v.type}`, dateTime: v.dateTime });
  }
  for (const v of live(data.vaccines)) {
    if (!v.boosterDate) continue;
    events.push({ uid: `vaccine-${v.id}`, kind: 'vaccine', title: `Richiamo vaccino: ${v.name}`, date: v.boosterDate });
  }

  return events
    .filter((e) => (e.date ?? toDateKey(e.dateTime)) >= todayKey)
    .map((e) => ({ ...e, reminders: reminderTimes(e, { reminderHour }) }))
    .map((e) => ({ e, t: e.dateTime ? Date.parse(e.dateTime) : zonedTimeToUtc(e.date, reminderHour).getTime() }))
    .sort((a, b) => a.t - b.t || (a.e.uid < b.e.uid ? -1 : 1))
    .map(({ e }) => e);
}
