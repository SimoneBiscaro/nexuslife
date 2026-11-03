import { daysBetween, toDateKey } from './dates.js';
import { deadlineStatus } from './deadlines.js';

export const VISIT_TYPES = ['dentista', 'oculista', 'controllo annuale', 'altro'];
export const STATUS_IT = { ok: 'In regola', warning: 'In avvicinamento', critical: 'Urgente', overdue: 'Scaduto', unknown: '—' };

const live = (list) => (list || []).filter((r) => !r.deleted && r.dateTime);

/**
 * Visite "Prossime" (dalla più vicina) e "Passate" (dalla più recente) rispetto a `now`.
 */
export function splitVisits(visits, now) {
  const t = new Date(now).getTime();
  const all = live(visits);
  return {
    upcoming: all.filter((v) => Date.parse(v.dateTime) >= t).sort((a, b) => Date.parse(a.dateTime) - Date.parse(b.dateTime)),
    past: all.filter((v) => Date.parse(v.dateTime) < t).sort((a, b) => Date.parse(b.dateTime) - Date.parse(a.dateTime)),
  };
}

/**
 * Conto alla rovescia verso una visita.
 * @returns {{ days: number, hours: number, minutes: number, calendarDays: number, label: string }}
 */
export function countdown(dateTime, now) {
  const ms = Math.max(0, Date.parse(dateTime) - new Date(now).getTime());
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const calendarDays = daysBetween(toDateKey(now), toDateKey(dateTime));
  let label;
  if (ms === 0) label = 'adesso';
  else if (calendarDays === 0) label = hours ? `oggi, tra ${hours} h ${minutes} min` : `oggi, tra ${minutes} min`;
  else if (calendarDays === 1) label = 'domani';
  else label = `tra ${calendarDays} giorni`;
  return { days, hours, minutes, calendarDays, label };
}

/** Stato del richiamo di un vaccino secondo le regole delle scadenze (§7). */
export function boosterStatus(vaccine, today) {
  return vaccine.boosterDate ? deadlineStatus(vaccine.boosterDate, today) : null;
}

/** Libretto: dalla vaccinazione più recente. */
export function sortVaccines(vaccines) {
  return (vaccines || []).filter((v) => !v.deleted).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
