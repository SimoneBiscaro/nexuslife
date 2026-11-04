import { loadEntities } from './queries.js';
import { loadSettings } from './settings.js';
import { toDateKey } from '../domain/dates.js';
import { buildReminderEvents } from '../domain/reminders.js';
import { buildCalendar } from '../domain/ics.js';
import { saveFile } from '../ui/download.js';

const ENTITIES = ['vehicle', 'vehicleDeadline', 'mileageReading', 'vehicleMaintenance', 'rentInstallment', 'bill', 'homeMaintenance', 'medicalVisit', 'visitPlan', 'vaccine'];

async function events() {
  const [data, settings] = await Promise.all([loadEntities(ENTITIES), loadSettings()]);
  const reminderHour = Number(settings.reminderHour) || 9;
  return { reminderHour, list: buildReminderEvents(data, { today: toDateKey(new Date()), reminderHour }) };
}

function download(ics, filename) {
  // MIME text/calendar: su iPhone il file si apre direttamente con Calendario.
  return saveFile(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), filename, { share: false });
}

/** "Esporta tutti i promemoria": un solo .ics con tutte le scadenze future. */
export async function exportAllReminders() {
  const { reminderHour, list } = await events();
  if (!list.length) return 0;
  await download(buildCalendar(list, { now: new Date(), reminderHour }), 'NexusLife_promemoria.ics');
  return list.length;
}

/**
 * "Aggiungi al Calendario" dal dettaglio: l'evento con quell'UID (es. "bill-<id>").
 * @returns {Promise<boolean>} false se la scadenza è già passata o non esiste
 */
export async function addToCalendar(uid) {
  const { reminderHour, list } = await events();
  const event = list.find((e) => e.uid === uid);
  if (!event) return false;
  const safe = event.title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_|_$/g, '');
  await download(buildCalendar([event], { now: new Date(), reminderHour }), `${safe || 'promemoria'}.ics`);
  return true;
}
