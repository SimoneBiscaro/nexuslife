import { addDays, addMonths, daysBetween, isDateKey, makeDateKey, toDateKey } from './dates.js';
import { deadlineStatus } from './deadlines.js';

/*
 * To Do: scadenze personali fuori dalle sezioni (es. "chiamare il barbiere").
 * Campi: title, dueDate?, notes, doneAt?, repeatEvery?, repeatUnit? ('giorni'|'settimane'|'mesi'), lastDoneAt?.
 * Una voce ripetuta non si chiude mai: "Fatto" la sposta alla prossima data.
 */

export const REPEAT_UNITS = ['giorni', 'settimane', 'mesi'];
/** Le voci fatte (non ripetute) spariscono dopo questi giorni. */
export const TODO_DONE_KEEP_DAYS = 30;

/** true se la voce si ripete. */
export function isRepeating(todo) {
  return Number(todo?.repeatEvery) > 0 && REPEAT_UNITS.includes(todo?.repeatUnit);
}

/** Data + intervallo di ripetizione. */
export function addRepeat(key, every, unit) {
  const n = Number(every);
  if (unit === 'mesi') return addMonths(key, n);
  return addDays(key, unit === 'settimane' ? n * 7 : n);
}

/** "ogni 5 settimane", "ogni giorno", "ogni mese". */
export function repeatLabel(todo) {
  if (!isRepeating(todo)) return '';
  const n = Number(todo.repeatEvery);
  const one = { giorni: 'giorno', settimane: 'settimana', mesi: 'mese' }[todo.repeatUnit];
  return n === 1 ? `ogni ${one}` : `ogni ${n} ${todo.repeatUnit}`;
}

/**
 * Stato di una voce: fatta = ok e chiusa; aperta = stato scadenza della data (unknown senza data).
 * @returns {{ done: boolean, repeating: boolean, status: string, days: number|null }}
 */
export function todoState(todo, today) {
  const repeating = isRepeating(todo);
  const done = !repeating && Boolean(todo.doneAt);
  const date = done ? null : todo.dueDate || null;
  return { done, repeating, status: done ? 'ok' : deadlineStatus(date, today), days: date ? daysBetween(today, date) : null };
}

/**
 * Patch per "Fatto". Ripetuta: la prossima data parte da oggi (es. barbiere ogni 5 settimane
 * dall'ultimo taglio) e si registra lastDoneAt; senza data parte da oggi lo stesso. Non ripetuta: doneAt.
 */
export function markTodoDone(todo, today) {
  const key = toDateKey(today);
  if (!isRepeating(todo)) return { doneAt: key };
  return { dueDate: addRepeat(key, todo.repeatEvery, todo.repeatUnit), lastDoneAt: key };
}

/**
 * Voci aperte (scadute, poi per data, poi senza data) e fatte (dalla più recente).
 * @returns {{ open: Array<{ todo } & ReturnType<typeof todoState>>, done: Array<object> }}
 */
export function sortTodos(todos, today) {
  const all = (todos || []).filter((t) => !t.deleted).map((todo) => ({ todo, ...todoState(todo, today) }));
  const open = all.filter((x) => !x.done).sort((a, b) =>
    (!a.todo.dueDate !== !b.todo.dueDate ? (a.todo.dueDate ? -1 : 1) : 0)
    || String(a.todo.dueDate || '').localeCompare(String(b.todo.dueDate || ''))
    || String(a.todo.createdAt || '').localeCompare(String(b.todo.createdAt || '')));
  const done = all.filter((x) => x.done).sort((a, b) => String(b.todo.doneAt).localeCompare(String(a.todo.doneAt)));
  return { open, done };
}

/** Voci fatte da più di 30 giorni: da eliminare all'avvio. */
export function expiredTodos(todos, today) {
  return (todos || []).filter((t) => !t.deleted && !isRepeating(t) && t.doneAt
    && daysBetween(toDateKey(t.doneAt), today) > TODO_DONE_KEEP_DAYS);
}

const WEEKDAYS = ['domenica', 'lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi', 'sabato'];
const plainText = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Aggiunta rapida: la data in fondo al testo diventa la scadenza.
 * Riconosce: oggi, domani, dopodomani, lunedì…domenica (il prossimo), "tra N giorni/settimane/mesi",
 * "il 12/11", "12/11", "12/11/2027". Il resto è il titolo.
 * @param {string} input
 * @param {string} today
 * @returns {{ title: string, dueDate: string|null }}
 */
export function parseTodoInput(input, today) {
  const text = String(input || '').trim().replace(/\s+/g, ' ');
  const plain = plainText(text);
  const cut = (len) => text.slice(0, text.length - len).trim().replace(/[\s,]+(entro|per|il|di|da)$/i, '').replace(/,$/, '').trim();
  const result = parseDate(plain, today, cut);
  // solo una data senza testo: resta tutto titolo
  return result && result.title ? result : { title: text, dueDate: null };
}

function parseDate(plain, today, cut) {
  let m;
  if ((m = plain.match(/(?:^|\s)(oggi|domani|dopodomani)$/))) {
    const add = { oggi: 0, domani: 1, dopodomani: 2 }[m[1]];
    return { title: cut(m[1].length), dueDate: addDays(today, add) };
  }
  if ((m = plain.match(/(?:^|\s)(lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica)$/))) {
    const target = WEEKDAYS.indexOf(m[1]);
    const current = new Date(`${toDateKey(today)}T12:00:00Z`).getUTCDay();
    const diff = ((target - current + 7) % 7) || 7;
    return { title: cut(m[1].length), dueDate: addDays(today, diff) };
  }
  if ((m = plain.match(/(?:^|\s)(tra|fra) (\d{1,3}) (giorni|giorno|settimane|settimana|mesi|mese)$/))) {
    const unit = m[3].startsWith('giorn') ? 'giorni' : m[3].startsWith('settiman') ? 'settimane' : 'mesi';
    return { title: cut(m[0].trim().length), dueDate: addRepeat(today, Number(m[2]), unit) };
  }
  if ((m = plain.match(/(?:^|\s)(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/))) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    let year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : Number(toDateKey(today).slice(0, 4));
    let key = month >= 1 && month <= 12 && day >= 1 && day <= 31 ? makeDateKey(year, month, day) : null;
    if (key && isDateKey(key)) {
      if (!m[3] && key < toDateKey(today)) { year += 1; key = makeDateKey(year, month, day); }
      if (isDateKey(key)) return { title: cut(m[0].trim().length), dueDate: key };
    }
  }
  return null;
}
