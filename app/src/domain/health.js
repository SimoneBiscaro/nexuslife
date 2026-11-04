import { addMonths, daysBetween, toDateKey } from './dates.js';
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

/* ---------- Visite da prenotare (visitPlan) ---------- */

/**
 * Stato di una visita da prenotare, singola o periodica (intervalMonths).
 * Le visite collegate (medicalVisit.planId) decidono lo stato:
 * - una visita futura collegata → "prenotata";
 * - singola con una visita passata collegata (o segnata fatta) → "fatta", esce dall'elenco;
 * - periodica: la prossima scadenza è l'ultima visita collegata + intervallo, altrimenti dueBy.
 * @param {{ id: string, intervalMonths?: number, dueBy?: string, doneAt?: string }} plan
 * @param {Array<object>} visits tutte le visite
 * @param {string|Date} now istante corrente
 * @returns {{ state: 'prenotata'|'fatta'|'daPrenotare', periodic: boolean, dueBy: string|null, status: string,
 *   days: number|null, booked: object|null, last: object|null }}
 */
export function visitPlanState(plan, visits, now) {
  const t = new Date(now).getTime();
  const today = toDateKey(now);
  const linked = live(visits).filter((v) => v.planId === plan.id);
  const booked = linked.filter((v) => Date.parse(v.dateTime) >= t).sort((a, b) => Date.parse(a.dateTime) - Date.parse(b.dateTime))[0] || null;
  const last = linked.filter((v) => Date.parse(v.dateTime) < t).sort((a, b) => Date.parse(b.dateTime) - Date.parse(a.dateTime))[0] || null;
  const periodic = Number(plan.intervalMonths) > 0;
  const base = { periodic, booked, last };
  if (booked) return { ...base, state: 'prenotata', dueBy: toDateKey(booked.dateTime), status: 'ok', days: daysBetween(today, toDateKey(booked.dateTime)) };
  if (!periodic && (last || plan.doneAt)) return { ...base, state: 'fatta', dueBy: null, status: 'ok', days: null };
  const dueBy = periodic && last ? addMonths(toDateKey(last.dateTime), Number(plan.intervalMonths)) : plan.dueBy || null;
  return { ...base, state: 'daPrenotare', dueBy, status: deadlineStatus(dueBy, today), days: dueBy ? daysBetween(today, dueBy) : null };
}

/** Visite da prenotare ancora aperte: prima quelle da prenotare per scadenza, poi le prenotate. */
export function openVisitPlans(plans, visits, now) {
  const rank = { daPrenotare: 0, prenotata: 1 };
  return (plans || []).filter((p) => !p.deleted)
    .map((plan) => ({ plan, ...visitPlanState(plan, visits, now) }))
    .filter((x) => x.state !== 'fatta')
    .sort((a, b) => rank[a.state] - rank[b.state]
      || (!a.dueBy !== !b.dueBy ? (a.dueBy ? -1 : 1) : 0)
      || String(a.dueBy || '').localeCompare(String(b.dueBy || '')));
}

/** Descrizione di una visita da prenotare: "Dentista · ogni 6 mesi". */
export function visitPlanLabel(plan) {
  const type = plan.type ? plan.type[0].toUpperCase() + plan.type.slice(1) : 'Visita';
  const every = Number(plan.intervalMonths) > 0 ? ` · ogni ${plan.intervalMonths} ${Number(plan.intervalMonths) === 1 ? 'mese' : 'mesi'}` : '';
  return `${type}${plan.doctor ? ` · ${plan.doctor}` : ''}${every}`;
}
