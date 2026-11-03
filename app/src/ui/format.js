import { formatDateKey, parseDateKey } from '../domain/dates.js';

const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
const int = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 });
const dec1 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
const longDate = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const shortDate = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const weekdayDate = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

export const formatEuro = (n) => eur.format(Number(n) || 0);
export const formatInt = (n) => int.format(Number(n) || 0);
export const formatKm = (n) => `${int.format(Number(n) || 0)} km`;
export const formatDecimal = (n) => dec1.format(Number(n) || 0);
export const formatDate = (key) => (key ? formatDateKey(key) : '—');

const utc = (key) => { const { year, month, day } = parseDateKey(key); return new Date(Date.UTC(year, month - 1, day)); };
export const formatLongDate = (key) => (key ? longDate.format(utc(key)) : '—');
export const formatShortDate = (key) => (key ? shortDate.format(utc(key)) : '—');
export const formatWeekdayDate = (key) => (key ? weekdayDate.format(utc(key)) : '—');

/**
 * Numero scritto all'italiana: "1.234,50", "12,5", "15000". null se vuoto o non valido.
 */
export function parseDecimal(text) {
  const s = String(text ?? '').trim().replace(/\s|€/g, '');
  if (!s) return null;
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/\.(?=\d{3}(\D|$))/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

/** Intero non negativo (km): accetta separatori delle migliaia. */
export function parseKm(text) {
  const s = String(text ?? '').replace(/[\s.']/g, '');
  if (!/^\d+$/.test(s)) return null;
  return Number(s);
}

/**
 * Data breve con articolo corretto: "l'8 nov", "l'11 nov", "il 20 nov".
 * Aggiunge l'anno se diverso da quello di `today`.
 */
export function formatDueDate(key, today) {
  if (!key) return '—';
  const { day } = parseDateKey(key);
  const withYear = today && key.slice(0, 4) !== String(today).slice(0, 4);
  const text = withYear ? `${formatShortDate(key)} ${key.slice(0, 4)}` : formatShortDate(key);
  return `${day === 8 || day === 11 ? "l'" : 'il '}${text}`;
}
