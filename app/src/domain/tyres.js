import { daysBetween, toDateKey } from './dates.js';
import { deadlineStatus } from './deadlines.js';

/*
 * Cambio gomme stagionale con le date nazionali italiane:
 * invernali da montare tra il 15 ottobre e il 15 novembre (obbligo fino al 15 aprile),
 * estive da rimontare tra il 15 aprile e il 15 maggio. Le quattro stagioni non si cambiano.
 */

export const TYRE_TYPES = ['estive', 'invernali', 'quattroStagioni'];
export const TYRE_LABEL = { estive: 'Estive', invernali: 'Invernali', quattroStagioni: 'Quattro stagioni' };

/** Finestre di montaggio (MM-GG): da `from` a `due` compresi. */
export const TYRE_WINDOWS = {
  invernali: { from: '10-15', due: '11-15' },
  estive: { from: '04-15', due: '05-15' },
};

/** Mesi di una stagione, per il riempimento dell'indicatore. */
export const TYRE_SEASON_MONTHS = 6;

/**
 * Prossimo cambio gomme.
 * Con le estive montate il cambio è verso le invernali entro il 15 novembre; se siamo già
 * nel periodo invernale (dopo il 15 novembre e fino al 14 aprile) il cambio è in ritardo.
 * Con le invernali il cambio è verso le estive entro il 15 maggio; dopo, fino al 14 ottobre,
 * è in ritardo; dal 15 ottobre le invernali vanno bene fino al 15 maggio successivo.
 * @param {{ tyreType?: string }} vehicle
 * @param {string} today AAAA-MM-GG
 * @returns {null|{ current: string, target: string, from: string, due: string, status: string, days: number, inWindow: boolean }}
 *   null se il tipo non è indicato o sono quattro stagioni
 */
export function tyreChange(vehicle, today) {
  const current = vehicle?.tyreType;
  if (current !== 'estive' && current !== 'invernali') return null;
  const key = toDateKey(today);
  const year = Number(key.slice(0, 4));
  const md = key.slice(5);
  let target;
  let dueYear;
  if (current === 'estive') {
    target = 'invernali';
    dueYear = md < TYRE_WINDOWS.estive.from ? year - 1 : year; // ancora nel periodo invernale: cambio dell'autunno scorso
  } else {
    target = 'estive';
    dueYear = md >= TYRE_WINDOWS.invernali.from ? year + 1 : year;
  }
  const w = TYRE_WINDOWS[target];
  const due = `${dueYear}-${w.due}`;
  const from = `${dueYear}-${w.from}`;
  return {
    current, target, from, due,
    status: deadlineStatus(due, key),
    days: daysBetween(key, due),
    inWindow: key >= from && key <= due,
  };
}

/** Patch del veicolo dopo il cambio: nuovo tipo montato e data. */
export function tyreChangePatch(vehicle, today) {
  const change = tyreChange(vehicle, today);
  return change ? { tyreType: change.target, tyreChangedAt: toDateKey(today) } : null;
}
