import { daysBetween, isDateKey, toDateKey } from './dates.js';

/*
 * Prenotazioni di tagliando, revisione e cambio gomme (CLAUDE.md §7).
 * Una prenotazione con data da oggi in poi rende la voce "booked": prevale sullo stato della
 * scadenza originale, che resta calcolata (originalStatus) per mostrarla in piccolo.
 * Una prenotazione passata e non confermata diventa "bookingPast" (gravità di un warning).
 * Bollo e assicurazione non si prenotano.
 */

export const BOOKING_KINDS = ['tagliando', 'revisione', 'gomme'];

/** Prefisso dei campi per tipo: tagliando e gomme sul vehicle, revisione sul vehicleDeadline. */
export const BOOKING_PREFIX = { tagliando: 'serviceBooked', gomme: 'tyreBooked', revisione: 'booked' };

/** Senza la data in cui si è prenotato, l'anello si svuota nell'ultimo mese. */
export const BOOKING_FALLBACK_DAYS = 30;

const FOR_RE = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}):(\d{2}))?$/;

function fieldNames(kind) {
  const p = BOOKING_PREFIX[kind];
  if (!p) throw new Error(`Prenotazione non prevista per ${kind}`);
  return { for: `${p}For`, place: `${p}Place`, notes: `${p}Notes`, on: `${p}On` };
}

/**
 * "AAAA-MM-GG" oppure "AAAA-MM-GGTHH:mm" (ora locale di Roma) → { date, time } o null.
 * @param {string} value
 */
export function parseBookedFor(value) {
  const m = FOR_RE.exec(String(value ?? ''));
  if (!m || !isDateKey(m[1])) return null;
  if (m[2] === undefined) return { date: m[1], time: null };
  const h = Number(m[2]);
  const min = Number(m[3]);
  if (h > 23 || min > 59) return { date: m[1], time: null };
  return { date: m[1], time: `${m[2]}:${m[3]}` };
}

/** Data (e ora facoltativa "HH:mm") nel formato salvato. */
export function formatBookedFor(date, time) {
  return time ? `${date}T${time}` : date;
}

/**
 * Prenotazione di un record, o null.
 * @param {object} record vehicle (tagliando, gomme) o vehicleDeadline (revisione)
 * @param {'tagliando'|'revisione'|'gomme'} kind
 * @returns {null|{ kind, date: string, time: string|null, place: string, notes: string, bookedOn: string|null }}
 */
export function readBooking(record, kind) {
  if (!record || !BOOKING_PREFIX[kind]) return null;
  if (kind === 'revisione' && record.type !== 'revisione') return null;
  const f = fieldNames(kind);
  const parsed = parseBookedFor(record[f.for]);
  if (!parsed) return null;
  return {
    kind,
    date: parsed.date,
    time: parsed.time,
    place: String(record[f.place] ?? '').trim(),
    notes: String(record[f.notes] ?? '').trim(),
    bookedOn: isDateKey(record[f.on]) ? record[f.on] : null,
  };
}

/** 'booked' se la data è da oggi in poi, 'bookingPast' se è passata, null senza prenotazione. */
export function bookingState(booking, today) {
  if (!booking) return null;
  return booking.date >= toDateKey(today) ? 'booked' : 'bookingPast';
}

/**
 * Porzione di attesa rimanente fino all'appuntamento (1 = appena prenotato, 0 = è oggi).
 * Il periodo parte dal giorno della prenotazione; senza, dagli ultimi 30 giorni.
 */
export function bookingRatio(booking, today) {
  if (!booking) return 0;
  const left = daysBetween(toDateKey(today), booking.date);
  if (left <= 0) return 0;
  const span = booking.bookedOn ? daysBetween(booking.bookedOn, booking.date) : BOOKING_FALLBACK_DAYS;
  if (!(span > 0)) return 1;
  return Math.min(1, Math.max(0, left / span));
}

/**
 * Applica la prenotazione allo stato di una scadenza.
 * @param {{ status: string }} base stato calcolato della scadenza originale
 * @param {object|null} booking da readBooking
 * @param {string} today
 * @returns {object} base + { status, originalStatus, booking, bookingState, bookingDays, bookingRatio }
 */
export function applyBooking(base, booking, today) {
  const state = bookingState(booking, today);
  if (!state) return { ...base, originalStatus: base.status, booking: null, bookingState: null, bookingDays: null, bookingRatio: 0 };
  return {
    ...base,
    status: state,
    originalStatus: base.status,
    booking,
    bookingState: state,
    bookingDays: daysBetween(toDateKey(today), booking.date),
    bookingRatio: bookingRatio(booking, today),
  };
}

/**
 * Campi da salvare per "Segna come prenotato" (o per modificarla).
 * `bookedOn` resta quello della prenotazione esistente, altrimenti oggi.
 * @param {'tagliando'|'revisione'|'gomme'} kind
 * @param {{ date: string, time?: string, place?: string, notes?: string }} input
 * @param {string} today
 * @param {object|null} [existing] prenotazione attuale (readBooking)
 */
export function bookingPatch(kind, { date, time, place, notes }, today, existing = null) {
  if (!isDateKey(date)) throw new Error('Data della prenotazione non valida');
  const f = fieldNames(kind);
  const t = time && /^\d{2}:\d{2}$/.test(time) ? time : null;
  return {
    [f.for]: formatBookedFor(date, t),
    [f.place]: String(place ?? '').trim(),
    [f.notes]: String(notes ?? '').trim(),
    [f.on]: existing?.bookedOn ?? toDateKey(today),
  };
}

/** Campi azzerati: "Annulla prenotazione" e chiusura dopo "Fatto". */
export function clearBookingPatch(kind) {
  const f = fieldNames(kind);
  return { [f.for]: null, [f.place]: null, [f.notes]: null, [f.on]: null };
}

/** Campi correnti, per ripristinarli con "Annulla" nel toast. */
export function bookingSnapshot(record, kind) {
  const f = fieldNames(kind);
  return { [f.for]: record?.[f.for] ?? null, [f.place]: record?.[f.place] ?? null, [f.notes]: record?.[f.notes] ?? null, [f.on]: record?.[f.on] ?? null };
}

/** Data proposta per "Fatto": quella dell'appuntamento, mai nel futuro. */
export function proposedDoneDate(booking, today) {
  const t = toDateKey(today);
  return booking && booking.date <= t ? booking.date : t;
}

/** Il record ha una prenotazione (anche passata)? */
export function hasBooking(record, kind) {
  return readBooking(record, kind) !== null;
}
