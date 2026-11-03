import { normalizeName, URGENCY_RANK } from './groceries.js';

/*
 * Deduplicazione dopo la sincronizzazione (CLAUDE.md §7).
 * Due dispositivi possono creare lo stesso oggetto offline: qui si sceglie un vincitore
 * in modo deterministico (stesso risultato su ogni dispositivo) e il perdente diventa tombstone.
 */

/** Targa normalizzata: maiuscole, solo lettere e cifre. */
export function normalizePlate(plate) {
  return String(plate ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const byLatest = (a, b) =>
  (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const byOldest = (a, b) =>
  (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const VEHICLE_CHILDREN = ['vehicleDeadline', 'mileageReading', 'vehicleExpense'];
const CATEGORY_CHILDREN = ['groceryItem', 'groceryPurchase'];

/**
 * @param {Array<object>} records tutti i record locali
 * @param {string} now istante ISO usato come updatedAt delle modifiche
 * @returns {Array<object>} record modificati (vincitori uniti, figli ricollegati, perdenti tombstone)
 */
export function dedupe(records, now) {
  const key = (r) => `${r.entity}:${r.id}`;
  const current = new Map(records.filter((r) => !r.deleted).map((r) => [key(r), r]));
  const changed = new Map();

  const save = (r) => {
    const next = { ...r, updatedAt: now };
    current.set(key(next), next);
    changed.set(key(next), next);
    return next;
  };
  const bury = (r) => save({ ...r, deleted: true });
  const liveOf = (entity) => [...current.values()].filter((r) => r.entity === entity && !r.deleted);

  /** Raggruppa per chiave (chiavi vuote ignorate) e restituisce i gruppi con duplicati. */
  const duplicates = (entity, keyFn, filter = () => true) => {
    const groups = new Map();
    for (const r of liveOf(entity).filter(filter)) {
      const k = keyFn(r);
      if (!k) continue;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
    return [...groups.values()].filter((g) => g.length > 1);
  };

  const remapChildren = (entities, field, remap) => {
    if (!remap.size) return;
    for (const e of entities) {
      for (const r of liveOf(e)) if (remap.has(r[field])) save({ ...r, [field]: remap.get(r[field]) });
    }
  };

  // Veicoli per targa normalizzata; scadenze, letture e spese seguono il vincitore.
  const vehicleRemap = new Map();
  for (const group of duplicates('vehicle', (v) => normalizePlate(v.plate))) {
    const [winner, ...losers] = [...group].sort(byLatest);
    for (const l of losers) { vehicleRemap.set(l.id, winner.id); bury(l); }
  }
  remapChildren(VEHICLE_CHILDREN, 'vehicleId', vehicleRemap);

  // Scadenze auto per (veicolo, tipo): vince la più recente.
  for (const group of duplicates('vehicleDeadline', (d) => d.vehicleId && d.type && `${d.vehicleId}|${d.type}`)) {
    const [, ...losers] = [...group].sort(byLatest);
    losers.forEach(bury);
  }

  // Rate per (contratto, periodKey): vince la pagata.
  for (const group of duplicates('rentInstallment', (i) => i.contractId && i.periodKey && `${i.contractId}|${i.periodKey}`)) {
    const [, ...losers] = [...group].sort((a, b) => (b.paidAt ? 1 : 0) - (a.paidAt ? 1 : 0) || byLatest(a, b));
    losers.forEach(bury);
  }

  // Feedback suggerimenti per normName: muted in OR, snooze massimo.
  for (const group of duplicates('suggestionFeedback', (f) => f.normName)) {
    const [winner, ...losers] = [...group].sort(byLatest);
    const muted = group.some((f) => f.muted);
    const snoozes = group.map((f) => f.snoozeUntil).filter(Boolean).sort();
    const snoozeUntil = snoozes.length ? snoozes[snoozes.length - 1] : null;
    if (winner.muted !== muted || (winner.snoozeUntil ?? null) !== snoozeUntil) save({ ...winner, muted, snoozeUntil });
    losers.forEach(bury);
  }

  // Categorie per normName: vince la predefinita, poi la più vecchia; articoli e acquisti seguono.
  const categoryRemap = new Map();
  for (const group of duplicates('groceryCategory', (c) => c.normName || normalizeName(c.name))) {
    const [winner, ...losers] = [...group].sort((a, b) => (b.builtin ? 1 : 0) - (a.builtin ? 1 : 0) || byOldest(a, b));
    for (const l of losers) { categoryRemap.set(l.id, winner.id); bury(l); }
  }
  remapChildren(CATEGORY_CHILDREN, 'categoryId', categoryRemap);

  // Articoli aperti per normName: quantità massima, urgenza più alta.
  for (const group of duplicates('groceryItem', (i) => i.normName, (i) => !i.archived)) {
    const [winner, ...losers] = [...group].sort(byLatest);
    const quantity = Math.max(...group.map((i) => Number(i.quantity) || 1));
    const urgency = group.reduce((u, i) => ((URGENCY_RANK[i.urgency] ?? 1) > (URGENCY_RANK[u] ?? 1) ? i.urgency : u), winner.urgency);
    if (winner.quantity !== quantity || winner.urgency !== urgency) save({ ...winner, quantity, urgency });
    losers.forEach(bury);
  }

  return [...changed.values()];
}
