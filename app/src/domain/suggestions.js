import { addDays, daysBetween, toDateKey } from './dates.js';

const WINDOW_DAYS = 180;
const MIN_PURCHASES = 3;
const THRESHOLD = 0.85;
const MAX_SUGGESTIONS = 8;
export const SNOOZE_DAYS = 3;

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function confidenceOf(variability) {
  if (variability < 0.25) return 'alta';
  if (variability < 0.5) return 'media';
  return 'bassa';
}

/**
 * Analisi del ritmo d'acquisto di un prodotto (date già filtrate per normName).
 * Più acquisti nello stesso giorno contano una volta.
 * @returns {null|{ purchases: number, cycle: number, variability: number, maturity: number, lastDate: string, confidence: string }}
 */
export function purchaseRhythm(dates, today) {
  const days = [...new Set(dates.map((d) => toDateKey(d)))]
    .filter((d) => { const ago = daysBetween(d, today); return ago >= 0 && ago <= WINDOW_DAYS; })
    .sort();
  if (days.length < MIN_PURCHASES) return null;
  const intervals = days.slice(1).map((d, i) => daysBetween(days[i], d));
  const cycle = median(intervals);
  if (!(cycle > 0)) return null;
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const sd = Math.sqrt(intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length);
  const variability = mean > 0 ? sd / mean : 0;
  const lastDate = days[days.length - 1];
  const maturity = daysBetween(lastDate, today) / cycle;
  return { purchases: days.length, cycle, variability, maturity, lastDate, confidence: confidenceOf(variability) };
}

/**
 * Suggerimenti spesa: storico 180 giorni, ≥3 acquisti, ciclo = mediana degli intervalli,
 * maturità = giorni dall'ultimo acquisto / ciclo. Suggerisce se maturità ≥ 0,85, non già in lista,
 * non silenziato, non posticipato. Confidenza bassa solo con maturità ≥ 1,0. Max 8, per maturità.
 * @param {{ purchases: Array<{normName:string,name:string,date:string,categoryId?:string,deleted?:boolean}>,
 *   openItems?: Array<{normName:string,archived?:boolean,deleted?:boolean}>,
 *   feedback?: Array<{normName:string,muted?:boolean,snoozeUntil?:string,deleted?:boolean}>, today: string }} input
 */
export function suggestGroceries({ purchases, openItems = [], feedback = [], today }) {
  const inList = new Set(openItems.filter((i) => !i.deleted && !i.archived).map((i) => i.normName));
  const fb = new Map(feedback.filter((f) => !f.deleted).map((f) => [f.normName, f]));
  const groups = new Map();
  for (const p of purchases) {
    if (p.deleted || !p.normName || !p.date) continue;
    if (!groups.has(p.normName)) groups.set(p.normName, []);
    groups.get(p.normName).push(p);
  }
  const todayKey = toDateKey(today);
  const out = [];
  for (const [normName, list] of groups) {
    if (inList.has(normName)) continue;
    const f = fb.get(normName);
    if (f?.muted) continue;
    if (f?.snoozeUntil && toDateKey(f.snoozeUntil) > todayKey) continue;
    const r = purchaseRhythm(list.map((p) => p.date), today);
    if (!r || r.maturity < THRESHOLD) continue;
    if (r.confidence === 'bassa' && r.maturity < 1) continue;
    const latest = list.reduce((a, b) => (toDateKey(b.date) >= toDateKey(a.date) ? b : a));
    out.push({ normName, name: latest.name, categoryId: latest.categoryId ?? null, ...r });
  }
  return out.sort((a, b) => b.maturity - a.maturity || a.normName.localeCompare(b.normName)).slice(0, MAX_SUGGESTIONS);
}

/** Data fino a cui un suggerimento posticipato resta nascosto (3 giorni). */
export function snoozeUntil(today) {
  return addDays(today, SNOOZE_DAYS);
}
