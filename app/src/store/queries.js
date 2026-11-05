import { getRepo } from './repo.js';
import { useQuery } from './state.js';

/** Entità usate da Oggi e Auto. */
export const ALL_SECTION_ENTITIES = [
  'vehicle', 'vehicleDeadline', 'mileageReading', 'vehicleExpense', 'rentInstallment', 'bill',
  'homeMaintenance', 'medicalVisit', 'vaccine', 'groceryItem', 'groceryPurchase', 'suggestionFeedback',
  'rentContract', 'homePurchase', 'vehicleMaintenance', 'vehiclePurchase', 'visitPlan', 'todo', 'settings',
];

/** Chiave nell'oggetto risultato per ogni entità. */
const KEY = {
  vehicle: 'vehicles', vehicleDeadline: 'vehicleDeadlines', mileageReading: 'mileageReadings',
  vehicleExpense: 'vehicleExpenses', rentInstallment: 'rentInstallments', bill: 'bills',
  homeMaintenance: 'homeMaintenance', medicalVisit: 'medicalVisits', vaccine: 'vaccines',
  groceryItem: 'groceryItems', groceryCategory: 'groceryCategories', groceryPurchase: 'groceryPurchases',
  suggestionFeedback: 'suggestionFeedback', rentContract: 'rentContracts', homePurchase: 'homePurchases',
  vehicleMaintenance: 'vehicleMaintenance', vehiclePurchase: 'vehiclePurchases', visitPlan: 'visitPlans', todo: 'todos',
  settings: 'settings',
};

/** Carica i record non eliminati delle entità indicate. */
export async function loadEntities(entities) {
  const repo = await getRepo();
  const lists = await Promise.all(entities.map((e) => repo.list(e)));
  return Object.fromEntries(entities.map((e, i) => [KEY[e] ?? e, lists[i]]));
}

/** Hook: dati delle entità, ricaricati quando cambiano. */
export function useEntities(entities) {
  return useQuery(() => loadEntities(entities), entities);
}
