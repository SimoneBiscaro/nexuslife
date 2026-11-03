/*
 * Date di calendario pure. Una data è una stringa "AAAA-MM-GG" (dateKey) interpretata
 * nel fuso Europe/Rome. Nessuna funzione legge l'orologio: `today` arriva sempre dall'esterno.
 */

export const TIME_ZONE = 'Europe/Rome';
const DAY_MS = 86_400_000;
const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const formatters = new Map();

function pad(n, len = 2) {
  return String(n).padStart(len, '0');
}

export function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Giorni nel mese (month 1–12). */
export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function makeDateKey(year, month, day) {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** true se `value` è una dateKey valida (esistente nel calendario). */
export function isDateKey(value) {
  if (typeof value !== 'string') return false;
  const m = KEY_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

/** @returns {{ year: number, month: number, day: number }} */
export function parseDateKey(key) {
  if (!isDateKey(key)) throw new RangeError(`Data non valida: ${key}`);
  const [y, m, d] = key.split('-').map(Number);
  return { year: y, month: m, day: d };
}

function partsIn(timeZone, ms) {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    formatters.set(timeZone, fmt);
  }
  const out = {};
  for (const p of fmt.formatToParts(new Date(ms))) if (p.type !== 'literal') out[p.type] = Number(p.value);
  return out;
}

/**
 * Converte in dateKey nel fuso indicato.
 * Accetta una dateKey (restituita invariata), un istante ISO o un Date. null/'' → null.
 */
export function toDateKey(value, timeZone = TIME_ZONE) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' && KEY_RE.test(value)) {
    if (!isDateKey(value)) throw new RangeError(`Data non valida: ${value}`);
    return value;
  }
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(ms)) throw new RangeError(`Data non valida: ${value}`);
  const p = partsIn(timeZone, ms);
  return makeDateKey(p.year, p.month, p.day);
}

function dayNumber(key) {
  const { year, month, day } = parseDateKey(key);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

function fromDayNumber(n) {
  const d = new Date(n * DAY_MS);
  return makeDateKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * Differenza in giorni di calendario (to − from) nel fuso di Roma.
 * Indipendente dall'ora legale: conta i cambi di data, non le 24 ore.
 */
export function daysBetween(from, to) {
  return dayNumber(toDateKey(to)) - dayNumber(toDateKey(from));
}

export function addDays(key, days) {
  return fromDayNumber(dayNumber(toDateKey(key)) + days);
}

/** Aggiunge mesi; se il giorno non esiste nel mese d'arrivo si ferma all'ultimo (31/1 + 1 → 28 o 29/2). */
export function addMonths(key, months) {
  const { year, month, day } = parseDateKey(toDateKey(key));
  const total = year * 12 + (month - 1) + months;
  const y = Math.floor(total / 12);
  const m = total - y * 12 + 1;
  return makeDateKey(y, m, Math.min(day, daysInMonth(y, m)));
}

export function endOfMonth(key) {
  const { year, month } = parseDateKey(toDateKey(key));
  return makeDateKey(year, month, daysInMonth(year, month));
}

/** Chiave del mese "AAAA-MM". */
export function periodKeyOf(key) {
  return toDateKey(key).slice(0, 7);
}

/** Primo giorno del mese indicato da una periodKey "AAAA-MM". */
export function periodStart(periodKey) {
  return `${periodKey}-01`;
}

export function compareDateKeys(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Offset del fuso (ms) all'istante dato: ora locale − UTC. */
export function timeZoneOffsetMs(instantMs, timeZone = TIME_ZONE) {
  const p = partsIn(timeZone, instantMs);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

/**
 * Istante UTC corrispondente a un'ora locale di Roma (gestisce ora legale/solare).
 * Nelle ore inesistenti (cambio di marzo) avanza di un'ora come fanno gli orologi.
 */
export function zonedTimeToUtc(key, hour = 0, minute = 0, timeZone = TIME_ZONE) {
  const { year, month, day } = parseDateKey(toDateKey(key));
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let t = wall - timeZoneOffsetMs(wall, timeZone);
  const second = wall - timeZoneOffsetMs(t, timeZone);
  if (second !== t) t = Math.max(t, second);
  return new Date(t);
}

const monthFmt = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' });
/** "novembre 2026" da "2026-11". */
export function formatPeriod(periodKey) {
  const [y, m] = periodKey.split('-').map(Number);
  return monthFmt.format(new Date(Date.UTC(y, m - 1, 1)));
}

const dayFmt = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
/** "07/11/2026" da "2026-11-07". */
export function formatDateKey(key) {
  const { year, month, day } = parseDateKey(key);
  return dayFmt.format(new Date(Date.UTC(year, month - 1, day)));
}
