/*
 * Calendario iCalendar (RFC 5545) con i preavvisi del §7: VCALENDAR, VTIMEZONE Europe/Rome,
 * un VEVENT per scadenza con un VALARM per ogni preavviso. UID stabili: reimportando il file
 * Calendario aggiorna gli eventi invece di duplicarli (SEQUENCE cresce con le modifiche).
 */
import { toZonedIcs, zonedTimeToUtc } from './dates.js';
import { REMINDER_RULES } from './reminders.js';

const CRLF = '\r\n';
const enc = new TextEncoder();

/** Escape del testo (§3.3.11). */
export function escapeText(text) {
  return String(text ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Piegatura delle righe a 75 ottetti senza spezzare i caratteri UTF-8 (§3.1). */
export function foldLine(line) {
  if (enc.encode(line).length <= 75) return line;
  const parts = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = parts.length ? 74 : 75; // le righe di continuazione iniziano con uno spazio
    if (size + n > limit) { parts.push(current); current = ''; size = 0; }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

const utcStamp = (date) => new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const VTIMEZONE = [
  'BEGIN:VTIMEZONE', 'TZID:Europe/Rome',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST', 'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET', 'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
  'END:VTIMEZONE',
];

function alarmLines(event) {
  const rule = REMINDER_RULES[event.kind];
  if (!rule) return [];
  const triggers = rule.hours
    ? rule.hours.map((h) => ({ trigger: `-PT${h}H`, label: `${h} ore prima` }))
    : rule.days.map((dd) => ({ trigger: dd === 0 ? 'PT0S' : `-P${dd}D`, label: dd === 0 ? 'oggi' : dd === 1 ? 'domani' : `tra ${dd} giorni` }));
  return triggers.flatMap(({ trigger, label }) => [
    'BEGIN:VALARM', 'ACTION:DISPLAY', `TRIGGER:${trigger}`, `DESCRIPTION:${escapeText(`${event.title} · ${label}`)}`, 'END:VALARM',
  ]);
}

/**
 * Un VEVENT. Le scadenze a data sono alle `reminderHour` ora di Roma (30 minuti);
 * le visite all'ora indicata (1 ora).
 */
function eventLines(event, { now, reminderHour }) {
  const start = event.dateTime ? toZonedIcs(event.dateTime) : toZonedIcs(zonedTimeToUtc(event.date, reminderHour));
  const sequence = event.updatedAt ? Math.floor(Date.parse(event.updatedAt) / 1000) - 1_700_000_000 : 0;
  return [
    'BEGIN:VEVENT',
    `UID:${event.uid}@nexuslife`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART;TZID=Europe/Rome:${start}`,
    `DURATION:${event.dateTime ? 'PT1H' : 'PT30M'}`,
    `SEQUENCE:${Math.max(0, sequence)}`,
    `SUMMARY:${escapeText(event.title)}`,
    ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
    ...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
    'TRANSP:TRANSPARENT',
    ...alarmLines(event),
    'END:VEVENT',
  ];
}

/**
 * @param {Array<{ uid, kind, title, date?, dateTime?, updatedAt?, location?, description? }>} events
 * @param {{ now: Date|string, reminderHour?: number, name?: string }} opts
 * @returns {string} testo .ics con terminatori CRLF
 */
export function buildCalendar(events, { now, reminderHour = 9, name = 'NexusLife' }) {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NexusLife//Promemoria//IT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(name)}`, 'X-WR-TIMEZONE:Europe/Rome',
    ...VTIMEZONE,
    ...events.flatMap((e) => eventLines(e, { now, reminderHour })),
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join(CRLF) + CRLF;
}

