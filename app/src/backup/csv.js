/*
 * CSV per Excel italiano: UTF-8 con BOM, separatore ";", decimali con la virgola,
 * date GG/MM/AAAA. I campi con ; " o a capo vanno tra virgolette (doppie raddoppiate).
 */
import { formatDateKey, isDateKey } from '../domain/dates.js';

const BOM = '﻿';
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const dateTimeFmt = new Intl.DateTimeFormat('it-IT', {
  timeZone: 'Europe/Rome', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** Valore di cella nel formato italiano. */
export function formatCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'sì' : 'no';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value).replace('.', ',') : '';
  if (typeof value === 'string') {
    if (isDateKey(value)) return formatDateKey(value);
    if (ISO_DATETIME.test(value) && Number.isFinite(Date.parse(value))) return dateTimeFmt.format(new Date(value)).replace(',', '');
    return value;
  }
  return JSON.stringify(value);
}

export function escapeCell(text) {
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * @param {Array<object>} rows
 * @param {Array<{ key: string, label?: string }>} columns
 */
export function toCsv(rows, columns) {
  const lines = [columns.map((c) => escapeCell(c.label ?? c.key)).join(';')];
  for (const row of rows) lines.push(columns.map((c) => escapeCell(formatCell(row[c.key]))).join(';'));
  return `${BOM}${lines.join('\r\n')}\r\n`;
}

const SKIP = new Set(['entity', 'deleted']);
const FIRST = ['id', 'name', 'title', 'type', 'kind', 'date', 'dueDate', 'dateTime', 'amount'];

/** Colonne di un'entità: unione dei campi dei record, con i più utili per primi. */
export function columnsFor(records) {
  const keys = new Set();
  for (const r of records) for (const k of Object.keys(r)) if (!SKIP.has(k)) keys.add(k);
  const order = (k) => { const i = FIRST.indexOf(k); return i === -1 ? FIRST.length : i; };
  const tail = ['createdAt', 'updatedAt'];
  return [...keys]
    .sort((a, b) => (tail.includes(a) - tail.includes(b)) || order(a) - order(b) || a.localeCompare(b))
    .map((key) => ({ key }));
}

/**
 * Lettura (per i test e per verificare i file): restituisce le righe come array di stringhe.
 */
export function parseCsv(text) {
  const s = text.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ';') { row.push(cell); cell = ''; }
    else if (ch === '\r' && s[i + 1] === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
