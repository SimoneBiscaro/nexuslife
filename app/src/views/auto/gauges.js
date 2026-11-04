import { remainingRatio, renewalMonths, STATUS_SEVERITY } from '../../domain/deadlines.js';
import { serviceKmRemainingRatio } from '../../domain/service.js';
import { DEADLINE_LABEL, DEADLINE_TYPES } from '../../domain/overview.js';
import { formatDueDate, formatInt } from '../../ui/format.js';
import { tyreChange, TYRE_LABEL, TYRE_SEASON_MONTHS } from '../../domain/tyres.js';

function daysValue(days) {
  if (days === null || days === undefined) return { value: null, unit: 'giorni' };
  if (days < 0) return { value: formatInt(-days), unit: -days === 1 ? 'giorno fa' : 'giorni fa' };
  return { value: formatInt(days), unit: days === 1 ? 'giorno' : 'giorni' };
}

/**
 * Modelli dei 5 HudGauge: Bollo, Assicurazione, Revisione (giorni), Tagliando
 * (km o giorni, quello più grave) e Gomme (giorni al prossimo cambio stagionale).
 */
export function vehicleGauges(overview, vehicle, today) {
  const gauges = DEADLINE_TYPES.map((type) => {
    const d = overview.deadlines[type];
    const due = d?.record.dueDate;
    const { value, unit } = daysValue(d?.days);
    return {
      key: type,
      label: DEADLINE_LABEL[type],
      value,
      unit,
      status: d?.status ?? 'unknown',
      ratio: due ? remainingRatio(due, renewalMonths(d.record), today) : 0,
      sublabel: !due ? 'tocca per impostare' : d.days < 0 ? `scaduto ${formatDueDate(due, today)}` : `scade ${formatDueDate(due, today)}`,
    };
  });

  const s = overview.service;
  const kmWorse = STATUS_SEVERITY[s.kmStatus] > STATUS_SEVERITY[s.dateStatus];
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

  const tc = tyreChange(vehicle, today);
  if (tc) {
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
