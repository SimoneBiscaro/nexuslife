import { daysBetween, formatPeriod, toDateKey } from './dates.js';
import { deadlineStatus, maintenanceNextDate, STATUS_SEVERITY } from './deadlines.js';
import { serviceStatus } from './service.js';
import { estimateKmPerDay, latestKm } from './mileage.js';

export const DEADLINE_TYPES = ['bollo', 'assicurazione', 'revisione'];
export const DEADLINE_LABEL = { bollo: 'Bollo', assicurazione: 'Assicurazione', revisione: 'Revisione', tagliando: 'Tagliando' };
const BILL_LABEL = { luce: 'Luce', gas: 'Gas', internet: 'Internet', acqua: 'Acqua', rifiuti: 'Rifiuti', altro: 'Altro' };

const live = (list) => (list || []).filter((r) => !r.deleted);

/** Saluto in base all'ora locale. */
export function greeting(hour) {
  if (hour >= 5 && hour < 13) return 'Buongiorno';
  if (hour >= 13 && hour < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

/** "oggi", "domani", "tra 5 giorni", "ieri", "3 giorni fa". */
export function daysLabel(days) {
  if (days === null || days === undefined) return 'data mancante';
  if (days === 0) return 'oggi';
  if (days === 1) return 'domani';
  if (days === -1) return 'ieri';
  return days > 0 ? `tra ${days} giorni` : `${-days} giorni fa`;
}

/** Stato di un pagamento non saldato come scadenza (scaduto se la data è passata). */
function paymentDeadlineStatus(dueDate, today) {
  return deadlineStatus(dueDate, today);
}

/**
 * Stato completo del veicolo: le tre scadenze e il tagliando.
 * @returns {{ deadlines: Record<string, object|null>, service: object, kmPerDay: object, currentKm: number }}
 */
export function vehicleOverview(vehicle, { deadlines = [], readings = [] }, today) {
  const mine = live(deadlines).filter((d) => d.vehicleId === vehicle.id);
  const myReadings = live(readings).filter((r) => r.vehicleId === vehicle.id);
  const currentKm = latestKm(vehicle, myReadings);
  const kmPerDay = estimateKmPerDay(myReadings, today);
  const service = serviceStatus({ ...vehicle, currentKm }, today, { kmPerDay: kmPerDay.kmPerDay });
  const byType = {};
  for (const type of DEADLINE_TYPES) {
    const d = mine.find((x) => x.type === type) || null;
    byType[type] = d && {
      record: d,
      status: deadlineStatus(d.dueDate, today),
      days: d.dueDate ? daysBetween(today, d.dueDate) : null,
    };
  }
  return { deadlines: byType, service, kmPerDay, currentKm };
}

/**
 * Tutte le scadenze delle sezioni in un formato comune, per banner e "prossime scadenze".
 * @returns {Array<{ key, section, kind, title, date, status, days, href }>}
 */
export function collectDeadlines(data, today) {
  const todayKey = toDateKey(today);
  const out = [];
  const push = (item) => out.push({ ...item, days: item.date ? daysBetween(todayKey, item.date) : null });

  for (const v of live(data.vehicles)) {
    const ov = vehicleOverview(v, { deadlines: data.vehicleDeadlines, readings: data.mileageReadings }, todayKey);
    const name = v.name || v.model || 'Auto';
    for (const type of DEADLINE_TYPES) {
      const d = ov.deadlines[type];
      if (!d?.record.dueDate) continue;
      push({ key: `vehicleDeadline:${d.record.id}:${d.record.dueDate}`, section: 'auto', kind: type,
        title: `${DEADLINE_LABEL[type]} · ${name}`, date: d.record.dueDate, status: d.status, href: '#/auto' });
    }
    const s = ov.service;
    const date = s.effectiveDate || s.nextDate;
    if (date || s.status !== 'unknown') {
      push({ key: `service:${v.id}:${s.nextDate}:${s.nextKm}`, section: 'auto', kind: 'tagliando',
        title: `Tagliando · ${name}`, date: date || todayKey, status: s.status, href: '#/auto' });
    }
  }
  for (const r of live(data.rentInstallments)) {
    if (r.paidAt || !r.dueDate) continue;
    push({ key: `rent:${r.id}`, section: 'casa', kind: 'affitto', title: `Affitto ${formatPeriod(r.periodKey)}`,
      date: r.dueDate, status: paymentDeadlineStatus(r.dueDate, todayKey), href: '#/casa' });
  }
  for (const b of live(data.bills)) {
    if (b.paidAt || !b.dueDate) continue;
    push({ key: `bill:${b.id}`, section: 'casa', kind: 'bolletta', title: `Bolletta ${BILL_LABEL[b.kind] ?? ''}`.trim(),
      date: b.dueDate, status: paymentDeadlineStatus(b.dueDate, todayKey), href: '#/casa' });
  }
  for (const m of live(data.homeMaintenance)) {
    const next = maintenanceNextDate(m);
    if (!next) continue;
    push({ key: `maintenance:${m.id}:${next}`, section: 'casa', kind: 'manutenzione', title: m.title,
      date: next, status: deadlineStatus(next, todayKey), href: '#/casa' });
  }
  for (const v of live(data.medicalVisits)) {
    if (!v.dateTime) continue;
    const date = toDateKey(v.dateTime);
    if (date < todayKey) continue; // una visita passata non è una scadenza
    push({ key: `visit:${v.id}`, section: 'salute', kind: 'visita', title: `Visita ${v.type}`,
      date, status: deadlineStatus(date, todayKey), href: '#/salute' });
  }
  for (const v of live(data.vaccines)) {
    if (!v.boosterDate) continue;
    push({ key: `vaccine:${v.id}:${v.boosterDate}`, section: 'salute', kind: 'richiamo', title: `Richiamo ${v.name}`,
      date: v.boosterDate, status: deadlineStatus(v.boosterDate, todayKey), href: '#/salute' });
  }
  return out;
}

/** Le prossime `n` scadenze per data (quelle già scadute per prime), a parità la più grave. */
export function upcomingDeadlines(items, n = 5) {
  return [...items]
    .filter((i) => i.date && i.status !== 'unknown')
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || STATUS_SEVERITY[b.status] - STATUS_SEVERITY[a.status])
    .slice(0, n);
}

/** Soglie selezionabili per il promemoria del backup (giorni). */
export const BACKUP_THRESHOLDS = [7, 14, 30, 60];

/**
 * Promemoria del backup in Oggi: se non c'è mai stato un pacchetto (e ci sono dati)
 * o se l'ultimo ha più giorni della soglia.
 * @returns {null|{ key: string, days: number|null, title: string, text: string }}
 */
export function backupReminder({ lastBackupAt, thresholdDays = 30, hasData }, today) {
  if (!lastBackupAt) {
    return hasData
      ? { key: 'backup:never', days: null, title: 'Fai il primo backup', text: 'Scarica un pacchetto con tutti i tuoi dati da Impostazioni → Backup.' }
      : null;
  }
  const days = daysBetween(toDateKey(lastBackupAt), today);
  if (days <= thresholdDays) return null;
  return { key: `backup:${toDateKey(lastBackupAt)}`, days, title: `Ultimo backup ${days} giorni fa`, text: 'Scarica un pacchetto aggiornato da Impostazioni → Backup.' };
}
