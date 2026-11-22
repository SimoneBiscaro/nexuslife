import { remainingRatio, renewalMonths, STATUS_SEVERITY } from '../../domain/deadlines.js';
import { serviceKmRemainingRatio } from '../../domain/service.js';
import { DEADLINE_LABEL, DEADLINE_TYPES } from '../../domain/overview.js';
import { bookingLabel, formatDayMonth, formatDueDate, formatInt, formatTime, formatWeekdayDate } from '../../ui/format.js';
import { TYRE_LABEL, TYRE_SEASON_MONTHS } from '../../domain/tyres.js';

function daysValue(days) {
  if (days === null || days === undefined) return { value: null, unit: 'giorni' };
  if (days < 0) return { value: formatInt(-days), unit: -days === 1 ? 'giorno fa' : 'giorni fa' };
  return { value: formatInt(days), unit: days === 1 ? 'giorno' : 'giorni' };
}

/** "scaduto 10/11", "scade 15/12" per la riga piccola sotto un gauge prenotato. */
function originalDateNote(due, today) {
  if (!due) return '';
  return `${due < today ? 'scaduto' : 'scade'} ${formatDayMonth(due, today)}`;
}

/**
 * Gauge di una voce prenotata (CLAUDE.md §5 e §7).
 * booked: giorni all'appuntamento, anello che si svuota fino al giorno fissato, icona calendario.
 * bookingPast: "Fatto?" per chiedere conferma.
 */
function bookedGauge(base, x, note, today) {
  const b = x.booking;
  const where = b.place ? `, ${b.place}` : '';
  if (x.status === 'bookingPast') {
    return { ...base, value: 'Fatto?', unit: '', status: 'bookingPast', ratio: 1, icon: 'calendar', askDone: true,
      sublabel: `appuntamento del ${formatDayMonth(b.date, today)}`, note,
      aria: `${base.label}: appuntamento del ${formatDayMonth(b.date, today)}${where} passato, da confermare se fatto. Scadenza originale: ${note || 'non indicata'}` };
  }
  const d = x.bookingDays;
  return { ...base, value: d === 0 ? 'oggi' : formatInt(d), unit: d === 0 ? '' : d === 1 ? 'giorno' : 'giorni', status: 'booked',
    ratio: x.bookingRatio, icon: 'calendar', sublabel: bookingLabel(b, today), note,
    aria: `${base.label}: prenotato ${d === 0 ? 'per oggi' : d === 1 ? 'per domani' : `tra ${d} giorni`}, ${formatWeekdayDate(b.date)}${b.time ? ` alle ${formatTime(b.time)}` : ''}${where}. Scadenza originale: ${note || 'non indicata'}` };
}

/**
 * Modelli dei 5 HudGauge: Bollo, Assicurazione, Revisione (giorni), Tagliando
 * (km o giorni, quello più grave) e Gomme (giorni al prossimo cambio stagionale).
 * Revisione, Tagliando e Gomme possono essere prenotati: allora contano i giorni all'appuntamento.
 */
export function vehicleGauges(overview, vehicle, today) {
  const gauges = DEADLINE_TYPES.map((type) => {
    const d = overview.deadlines[type];
    const due = d?.record.dueDate;
    const base = { key: type, label: DEADLINE_LABEL[type] };
    if (d?.booking) return bookedGauge(base, d, originalDateNote(due, today), today);
    const { value, unit } = daysValue(d?.days);
    return {
      ...base,
      value,
      unit,
      status: d?.status ?? 'unknown',
      ratio: due ? remainingRatio(due, renewalMonths(d.record), today) : 0,
      sublabel: !due ? 'tocca per impostare' : d.days < 0 ? `scaduto ${formatDueDate(due, today)}` : `scade ${formatDueDate(due, today)}`,
    };
  });

  const s = overview.service;
  const orig = s.originalStatus ?? s.status;
  const kmWorse = STATUS_SEVERITY[s.kmStatus] > STATUS_SEVERITY[s.dateStatus];
  if (s.booking) {
    const note = kmWorse && s.nextKm != null
      ? `scadeva a ${formatInt(s.nextKm)} km`
      : orig === 'unknown' ? '' : originalDateNote(s.nextDate, today);
    gauges.push(bookedGauge({ key: 'tagliando', label: 'Tagliando' }, s, note, today));
  } else {
    const timeRatio = s.nextDate ? remainingRatio(s.nextDate, Number(vehicle.serviceIntervalMonths) || 12, today) : null;
    const kmRatio = s.usedRatio !== null ? serviceKmRemainingRatio(s.usedRatio) : null;
    const ratios = [timeRatio, kmRatio].filter((r) => r !== null);
    let service;
    if (kmWorse) {
      service = s.kmRemaining < 0
        ? { value: formatInt(-s.kmRemaining), unit: 'km oltre' }
        : { value: formatInt(s.kmRemaining), unit: 'km' };
    } else {
      service = daysValue(s.daysRemaining);
    }
    gauges.push({
      key: 'tagliando',
      label: 'Tagliando',
      ...service,
      status: s.status,
      ratio: ratios.length ? Math.min(...ratios) : 0,
      sublabel: s.status === 'unknown' ? 'tocca per impostare' : kmWorse ? 'misurato in km' : `entro ${formatDueDate(s.nextDate, today)}`,
    });
  }

  const tc = overview.tyres;
  if (tc?.booking) {
    gauges.push(bookedGauge({ key: 'gomme', label: 'Gomme' }, tc, originalDateNote(tc.due, today), today));
  } else if (tc) {
    gauges.push({
      key: 'gomme', label: 'Gomme', ...daysValue(tc.days), status: tc.status,
      ratio: remainingRatio(tc.due, TYRE_SEASON_MONTHS, today),
      sublabel: `${TYRE_LABEL[tc.target].toLowerCase()} ${tc.days < 0 ? 'scaduto' : 'entro'} ${formatDueDate(tc.due, today)}`,
    });
  } else {
    const four = vehicle.tyreType === 'quattroStagioni';
    gauges.push({ key: 'gomme', label: 'Gomme', value: four ? '4S' : null, unit: four ? '' : 'giorni', status: four ? 'ok' : 'unknown',
      ratio: four ? 1 : 0, sublabel: four ? 'quattro stagioni' : 'tocca per impostare' });
  }
  return gauges;
}
