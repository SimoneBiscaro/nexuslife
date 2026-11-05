/*
 * "Carica dati demo" (Impostazioni): dati di esempio per provare l'app, tutti marcati demo:true
 * e quindi rimovibili in un colpo solo. Non vengono mai creati automaticamente.
 */
import { getRepo } from './repo.js';
import { ensureRentInstallments } from './home.js';
import { addDays, addMonths, toDateKey, zonedTimeToUtc } from '../domain/dates.js';
import { suggestCategory } from '../domain/groceries.js';

/**
 * Record demo (senza id e date di sistema), relativi a `today`.
 * @param {string} today
 * @param {Array<object>} categories categorie spesa esistenti (per assegnare gli articoli)
 */
export function buildDemoRecords(today, categories) {
  const out = [];
  const add = (entity, fields) => { const id = crypto.randomUUID(); out.push({ entity, id, demo: true, ...fields }); return id; };
  const cat = (normName) => suggestCategory(normName, { categories });
  const at = (days, hour, minute = 0) => zonedTimeToUtc(addDays(today, days), hour, minute).toISOString();

  const v = add('vehicle', {
    name: 'T-Cross demo', make: 'Volkswagen', model: 'T-Cross', color: 'Grigio metallizzato', plate: 'DEMO000',
    registrationDate: addMonths(today, -50), currentKm: 41800, serviceIntervalKm: 15000, serviceIntervalMonths: 12,
    lastServiceDate: addMonths(today, -11), lastServiceKm: 28500, photo: false, tyreType: 'estive', tyreChangedAt: addMonths(today, -7),
  });
  add('vehicleDeadline', { vehicleId: v, type: 'bollo', dueDate: addDays(today, 18), amount: 214, provider: 'ACI', notes: '' });
  add('vehicleDeadline', { vehicleId: v, type: 'assicurazione', dueDate: addDays(today, 5), amount: 520, provider: 'Assicurazione demo', recurrenceMonths: 12, notes: '' });
  add('vehicleDeadline', { vehicleId: v, type: 'revisione', dueDate: addDays(today, 140), amount: 79, provider: '', notes: '' });
  [[-90, 38900], [-45, 40350], [0, 41800]].forEach(([d, km]) => add('mileageReading', { vehicleId: v, date: addDays(today, d), km }));
  add('vehicleExpense', { vehicleId: v, date: addDays(today, -330), category: 'tagliando', amount: 289.5, km: 28500, description: 'Tagliando' });
  add('vehicleExpense', { vehicleId: v, date: addDays(today, -60), category: 'gomme', amount: 96, km: 39800, description: 'Cambio gomme' });
  add('vehicleMaintenance', { vehicleId: v, title: 'Cambio olio', intervalMonths: 12, intervalKm: 15000, lastDoneDate: addMonths(today, -11), lastDoneKm: 28500, notes: '' });
  add('vehicleMaintenance', { vehicleId: v, title: 'Liquido freni', intervalMonths: 24, intervalKm: null, lastDoneDate: addMonths(today, -20), lastDoneKm: null, notes: '' });
  add('vehicleMaintenance', { vehicleId: v, title: 'Sostituire tergicristalli', intervalMonths: null, intervalKm: null, dueDate: addDays(today, 12), doneAt: null, notes: '' });
  add('vehiclePurchase', { vehicleId: v, name: 'Catene da neve', category: 'sicurezza', priority: 'alta', estimatedPrice: 45, done: false });
  add('vehiclePurchase', { vehicleId: v, name: 'Tappetini in gomma', category: 'accessori', priority: 'bassa', estimatedPrice: 30, done: false });

  add('rentContract', { totalAmount: 900, personalShare: 450, dueDay: 5, startDate: addMonths(today, -14), landlord: 'Proprietario demo', notes: '' });
  add('bill', { kind: 'luce', dueDate: addDays(today, 6), amount: 78.4, provider: 'Fornitore demo', paidAt: null, notes: '' });
  add('bill', { kind: 'gas', dueDate: addDays(today, -25), amount: 112.9, provider: 'Fornitore demo', paidAt: addDays(today, -27), notes: '' });
  add('bill', { kind: 'internet', dueDate: addDays(today, -10), amount: 27.9, provider: 'Fornitore demo', paidAt: addDays(today, -11), notes: '' });
  add('homeMaintenance', { title: 'Caldaia', intervalMonths: 12, lastDoneDate: addMonths(addDays(today, 20), -12), notes: '' });
  add('homeMaintenance', { title: 'Filtri condizionatori', intervalMonths: 6, lastDoneDate: addMonths(today, -2), notes: '' });
  add('homeMaintenance', { title: 'Riparare il rubinetto del bagno', intervalMonths: null, dueDate: addDays(today, 10), doneAt: null, notes: '' });
  add('homePurchase', { name: 'Lampada da lettura', category: 'arredamento', priority: 'media', estimatedPrice: 35, done: false });

  [['Latte', 2, 'urgente'], ['Pasta', 1, 'normale'], ['Detersivo piatti', 1, 'normale']].forEach(([name, quantity, urgency]) => add('groceryItem', {
    name, normName: name.toLowerCase(), quantity, urgency, categoryId: cat(name.toLowerCase()),
    addedAt: at(-1, 18), checkedAt: null, archived: false,
  }));
  [['Pane', [15, 12, 9, 6, 3]], ['Caffè', [46, 31, 16]], ['Yogurt', [20, 13, 6]]].forEach(([name, days]) => days.forEach((d) => add('groceryPurchase', {
    normName: name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''), name, date: addDays(today, -d),
    categoryId: cat(name.toLowerCase()),
  })));

  const dentist = add('visitPlan', { type: 'dentista', doctor: 'Dott. Demo', intervalMonths: 6, dueBy: null, notes: 'Pulizia e controllo', doneAt: null });
  add('medicalVisit', { type: 'dentista', dateTime: at(9, 15, 30), doctor: 'Dott. Demo', place: 'Studio demo', notes: 'Pulizia annuale', postNotes: '', planId: dentist });
  add('medicalVisit', { type: 'dentista', dateTime: at(-170, 10), doctor: 'Dott. Demo', place: 'Studio demo', notes: '', postNotes: 'Nessuna carie', planId: dentist });
  add('medicalVisit', { type: 'controllo annuale', dateTime: at(-40, 9), doctor: 'Medico demo', place: 'Ambulatorio demo', notes: '', postNotes: 'Tutto nella norma' });
  add('visitPlan', { type: 'oculista', doctor: '', intervalMonths: null, dueBy: addDays(today, 20), notes: 'Serve l\'impegnativa del medico', doneAt: null });
  add('todo', { title: 'Chiamare il barbiere', dueDate: addDays(today, -1), notes: '', repeatEvery: 5, repeatUnit: 'settimane', doneAt: null });
  add('todo', { title: 'Regalo di compleanno per Luca', dueDate: addDays(today, 6), notes: 'Libro o biglietti del concerto', repeatEvery: null, repeatUnit: null, doneAt: null });
  add('todo', { title: 'Rinnovare la carta d\'identità', dueDate: addDays(today, 40), notes: '', repeatEvery: null, repeatUnit: null, doneAt: null });
  add('todo', { title: 'Riordinare la cantina', dueDate: null, notes: '', repeatEvery: null, repeatUnit: null, doneAt: null });
  add('todo', { title: 'Restituire il trapano a Marco', dueDate: addDays(today, -4), notes: '', repeatEvery: null, repeatUnit: null, doneAt: addDays(today, -2) });
  add('vaccine', { name: 'Tetano', date: addMonths(today, -118), lot: 'DEMO-01', boosterDate: addDays(today, 25), notes: '' });
  add('vaccine', { name: 'Antinfluenzale', date: addMonths(today, -12), lot: '', boosterDate: addDays(today, -3), notes: '' });
  return out;
}

export async function hasDemoData() {
  const repo = await getRepo();
  return (await repo.listAll()).some((r) => r.demo && !r.deleted);
}

export async function loadDemoData() {
  const repo = await getRepo();
  if (await hasDemoData()) return 0;
  const today = toDateKey(new Date());
  const records = buildDemoRecords(today, await repo.list('groceryCategory'));
  await repo.batch(records.map(({ entity, ...create }) => ({ entity, create })));
  await ensureRentInstallments(repo, today);
  return records.length;
}

/** Rimuove i dati demo (e le rate generate dal contratto demo). */
export async function removeDemoData() {
  const repo = await getRepo();
  const all = await repo.listAll();
  const demoContracts = new Set(all.filter((r) => r.demo && r.entity === 'rentContract').map((r) => r.id));
  const targets = all.filter((r) => !r.deleted && (r.demo || (r.entity === 'rentInstallment' && demoContracts.has(r.contractId))));
  await repo.batch(targets.map((r) => ({ entity: r.entity, id: r.id, patch: { deleted: true } })));
  return targets.length;
}
