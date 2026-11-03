import { addDays, daysBetween, toDateKey } from './dates.js';

export const GENERIC_KM_PER_DAY = 33;
export const MAX_KM_PER_DAY = 500;
const WINDOW_DAYS = 180;
const MIN_SPAN_DAYS = 14;

/**
 * Stima dei km/giorno con regressione lineare sulle letture degli ultimi 180 giorni.
 * Servono almeno 2 letture distanti almeno 14 giorni; pendenza limitata a [0, 500].
 * Altrimenti 33 km/giorno con etichetta "stima generica".
 * @param {Array<{ date: string, km: number }>} readings
 * @returns {{ kmPerDay: number, generic: boolean, label: string, samples: number }}
 */
export function estimateKmPerDay(readings, today) {
  const points = (readings || [])
    .filter((r) => r && !r.deleted && r.date && Number.isFinite(Number(r.km)))
    .map((r) => ({ x: daysBetween(today, r.date), y: Number(r.km) }))
    .filter((p) => p.x <= 0 && p.x >= -WINDOW_DAYS);

  const generic = { kmPerDay: GENERIC_KM_PER_DAY, generic: true, label: 'stima generica', samples: points.length };
  if (points.length < 2) return generic;
  const xs = points.map((p) => p.x);
  if (Math.max(...xs) - Math.min(...xs) < MIN_SPAN_DAYS) return generic;

  const n = points.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - mx) * (p.y - my);
    den += (p.x - mx) ** 2;
  }
  if (den === 0) return generic;
  const slope = Math.min(MAX_KM_PER_DAY, Math.max(0, num / den));
  return { kmPerDay: slope, generic: false, label: 'dalle tue letture', samples: n };
}

/** Km attuali: il massimo tra il valore sul veicolo e le letture registrate. */
export function latestKm(vehicle, readings = []) {
  const values = [Number(vehicle?.currentKm) || 0, ...readings.filter((r) => !r.deleted).map((r) => Number(r.km) || 0)];
  return Math.max(...values);
}

/**
 * Data stimata in cui si raggiungono `targetKm`. null se la stima è 0 km/giorno.
 * Se i km sono già superati restituisce `today`.
 */
export function estimateDateForKm(targetKm, currentKm, kmPerDay, today) {
  const remaining = targetKm - currentKm;
  if (remaining <= 0) return toDateKey(today);
  if (!(kmPerDay > 0)) return null;
  return addDays(today, Math.ceil(remaining / kmPerDay));
}
