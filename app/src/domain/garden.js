import { daysBetween, formatPeriod, toDateKey } from './dates.js';
import { deadlineStatus, maintenanceNextDate, STATUS_SEVERITY } from './deadlines.js';
import { DEADLINE_LABEL, DEADLINE_TYPES, vehicleOverview } from './overview.js';
import { estimateKmPerDay } from './mileage.js';
import { urgencyGlow } from './groceries.js';

/*
 * Giardino zen: una pianta per categoria, la cui salute riassume le cose in sospeso.
 * Tutto è derivato dai record esistenti: nessuna entità nuova, nessun dato salvato.
 */

/** Le piante, nell'ordine in cui compaiono nel giardino. */
export const GARDEN_PLANTS = [
  { id: 'auto', label: 'Auto', href: '#/auto', section: 'auto' },
  { id: 'affitto', label: 'Affitto e bollette', href: '#/casa', section: 'casa' },
  { id: 'manutenzioni', label: 'Manutenzioni', href: '#/casa', section: 'casa' },
  { id: 'spesa', label: 'Spesa', href: '#/spesa', section: 'spesa' },
  { id: 'salute', label: 'Salute', href: '#/salute', section: 'salute' },
  { id: 'backup', label: 'Backup', href: '#/impostazioni', section: 'impostazioni' },
];

/** Penalità per stato: quanto un elemento toglie alla salute della pianta. */
export const STATUS_PENALTY = { unknown: 0, ok: 0, warning: 0.15, critical: 0.40, overdue: 0.70 };
/** Uno scaduto pesa sempre di più col passare dei giorni, fino a questo tetto dopo 30 giorni. */
export const OVERDUE_MAX_PENALTY = 0.95;
export const OVERDUE_RAMP_DAYS = 30;

/** Stato immediatamente più grave (per il pavimento dei problemi lievi). */
const NEXT_STATUS = { unknown: null, ok: null, warning: 'critical', critical: 'overdue', overdue: null };

/** Giorni passati dalla scadenza, ≥ 0. */
const overdueDaysOf = (issue) => Math.max(0, Number(issue.overdueDays) || 0);

/**
 * Penalità di un singolo elemento in [0, 0,95].
 * @param {{ status: string, overdueDays?: number }} issue
 */
export function issuePenalty(issue) {
  const base = STATUS_PENALTY[issue.status] ?? 0;
  if (issue.status !== 'overdue') return base;
  const ramp = Math.min(1, overdueDaysOf(issue) / OVERDUE_RAMP_DAYS);
  return base + (OVERDUE_MAX_PENALTY - base) * ramp;
}

/** Elementi che contano davvero (ok e dati mancanti non tolgono nulla). */
export const isPending = (issue) => issuePenalty(issue) > 0;

/**
 * Punteggio di salute in [0, 1].
 * Ogni elemento moltiplica la salute per (1 − penalità): più problemi abbassano sempre il punteggio.
 * Pavimento: tanti problemi lievi non rendono mai la pianta più malata di un singolo problema
 * del livello di gravità successivo (es. dieci "in avvicinamento" non valgono più di un "urgente").
 * @param {Array<{ status: string, overdueDays?: number }>} issues
 */
export function healthScore(issues) {
  const pending = (issues || []).filter(isPending);
  if (pending.length === 0) return 1;
  const product = pending.reduce((acc, i) => acc * (1 - issuePenalty(i)), 1);
  const worst = pending.reduce((w, i) => (STATUS_SEVERITY[i.status] > STATUS_SEVERITY[w] ? i.status : w), 'ok');
  const next = NEXT_STATUS[worst];
  const floor = next ? 1 - STATUS_PENALTY[next] : 0;
  return round3(Math.max(product, floor));
}

const round3 = (n) => Math.round(n * 1000) / 1000;

/**
 * Stadi visivi, dal più sano. `min` è il punteggio minimo; gli altri campi descrivono il disegno:
 * altezza relativa, tonalità delle foglie, foglie sul fusto, fiori aperti/chiusi, foglie cadute,
 * piegatura delle foglie (0 dritte → 1 cadenti).
 */
export const GARDEN_STAGES = [
  { id: 'fiorita', label: 'Fiorita', min: 0.9, height: 1, tone: 'lush', leaves: 8, flowers: 3, buds: 0, fallen: 0, droop: 0 },
  { id: 'sana', label: 'Sana', min: 0.7, height: 0.88, tone: 'green', leaves: 7, flowers: 1, buds: 2, fallen: 0, droop: 0.15 },
  { id: 'assetata', label: 'Assetata', min: 0.45, height: 0.74, tone: 'yellow', leaves: 6, flowers: 0, buds: 2, fallen: 1, droop: 0.4 },
  { id: 'appassita', label: 'Appassita', min: 0.2, height: 0.6, tone: 'amber', leaves: 4, flowers: 0, buds: 1, fallen: 3, droop: 0.7 },
  { id: 'secca', label: 'Secca', min: 0, height: 0.46, tone: 'brown', leaves: 2, flowers: 0, buds: 0, fallen: 5, droop: 1 },
];
/** Germoglio neutro: categoria senza dati. */
export const SPROUT_STAGE = { id: 'germoglio', label: 'Germoglio', min: null, height: 0.3, tone: 'neutral', leaves: 2, flowers: 0, buds: 0, fallen: 0, droop: 0 };

export const STAGE_IDS = [...GARDEN_STAGES.map((s) => s.id), SPROUT_STAGE.id];

/** Stadio per un punteggio; senza dati il germoglio. */
export function stageFor(score, hasData = true) {
  if (!hasData) return SPROUT_STAGE;
  return GARDEN_STAGES.find((s) => score >= s.min) || GARDEN_STAGES[GARDEN_STAGES.length - 1];
}

/** Elementi in ordine di gravità (poi per data). */
export function sortIssues(issues) {
  return [...issues].sort((a, b) => issuePenalty(b) - issuePenalty(a)
    || STATUS_SEVERITY[b.status] - STATUS_SEVERITY[a.status]
    || String(a.date || '').localeCompare(String(b.date || '')));
}

/**
 * Pianta completa di una categoria.
 * @param {string} id una delle GARDEN_PLANTS
 * @param {Array<object>} issues
 * @param {boolean} hasData false → germoglio
 */
export function buildPlant(id, issues, hasData) {
  const meta = GARDEN_PLANTS.find((p) => p.id === id) || { id, label: id, href: '#/oggi' };
  const score = hasData ? healthScore(issues) : null;
  const stage = stageFor(score, hasData);
  const sorted = sortIssues(issues || []);
  const pending = sorted.filter(isPending);
  return { ...meta, hasData, score, stage, issues: sorted, pending: pending.length, summary: plantSummary(meta.label, stage, pending.length) };
}

/** Descrizione a parole per aria-label e sottotitoli. */
export function plantSummary(label, stage, pending) {
  if (stage.id === 'germoglio') return `${label}: germoglio, ancora nessun dato`;
  const cosa = pending === 0 ? 'tutto in ordine' : pending === 1 ? '1 cosa in sospeso' : `${pending} cose in sospeso`;
  return `${label}: ${stage.label.toLowerCase()}, ${cosa}`;
}

/* ---------- Testi delle cause ---------- */

const plural = (n, one, many) => (n === 1 ? one : many);

/**
 * "Bollo scaduto da 3 giorni", "Revisione scade tra 5 giorni", "Bolletta scade oggi".
 * @param {string} label
 * @param {number|null} days giorni mancanti (negativi se scaduto)
 * @param {boolean} [fem] concordanza al femminile
 */
export function dueText(label, days, fem = false) {
  if (days === null || days === undefined) return `${label}: data mancante`;
  if (days < 0) return `${label} ${fem ? 'scaduta' : 'scaduto'} da ${-days} ${plural(-days, 'giorno', 'giorni')}`;
  if (days === 0) return `${label} scade oggi`;
  if (days === 1) return `${label} scade domani`;
  return `${label} scade tra ${days} giorni`;
}

const FEM = new Set(['assicurazione', 'revisione']);
const live = (list) => (list || []).filter((r) => !r.deleted);

function dateIssue({ key, plant, label, fem, date, today, href, status, masked }) {
  const days = date ? daysBetween(today, date) : null;
  const st = status ?? deadlineStatus(date, today);
  return { key, plant, status: st, date: date || null, days, overdueDays: st === 'overdue' && days !== null ? -days : 0,
    title: dueText(label, days, fem), href, ...(masked ? { maskedTitle: masked } : {}) };
}

/* ---------- Le singole piante ---------- */

/** Auto: bollo, assicurazione, revisione e tagliando (data e km) di ogni veicolo. */
export function autoIssues(data, today) {
  const out = [];
  const vehicles = live(data.vehicles);
  const multi = vehicles.length > 1;
  for (const v of vehicles) {
    const ov = vehicleOverview(v, { deadlines: data.vehicleDeadlines, readings: data.mileageReadings }, today);
    const suffix = multi ? ` · ${v.name || v.model || 'Auto'}` : '';
    for (const type of DEADLINE_TYPES) {
      const d = ov.deadlines[type];
      const label = `${DEADLINE_LABEL[type]}${suffix}`;
      if (!d?.record.dueDate) {
        out.push({ key: `auto:${v.id}:${type}`, plant: 'auto', status: 'unknown', date: null, days: null, overdueDays: 0,
          title: `${label}: data da inserire`, href: '#/auto' });
        continue;
      }
      out.push(dateIssue({ key: `auto:${v.id}:${type}`, plant: 'auto', label, fem: FEM.has(type), date: d.record.dueDate, today, href: '#/auto' }));
    }
    out.push(serviceIssue(v, ov, data, today, suffix));
  }
  return out;
}

function serviceIssue(vehicle, ov, data, today, suffix) {
  const s = ov.service;
  const label = `Tagliando${suffix}`;
  const base = { key: `auto:${vehicle.id}:tagliando`, plant: 'auto', href: '#/auto' };
  if (s.status === 'unknown') return { ...base, status: 'unknown', date: null, days: null, overdueDays: 0, title: `${label}: dati da inserire` };
  // Giorni di ritardo: dalla data o, per i km, dai km in eccesso diviso il ritmo stimato.
  let overdueDays = 0;
  if (s.dateStatus === 'overdue') overdueDays = -s.daysRemaining;
  if (s.kmStatus === 'overdue' && s.kmRemaining < 0) {
    const readings = live(data.mileageReadings).filter((r) => r.vehicleId === vehicle.id);
    const { kmPerDay } = estimateKmPerDay(readings, today);
    overdueDays = Math.max(overdueDays, kmPerDay > 0 ? Math.round(-s.kmRemaining / kmPerDay) : OVERDUE_RAMP_DAYS);
  }
  let title;
  if (s.kmStatus === 'overdue' && s.kmRemaining < 0 && s.dateStatus !== 'overdue') {
    title = `${label} superato di ${new Intl.NumberFormat('it-IT').format(-s.kmRemaining)} km`;
  } else if (s.kmStatus !== 'unknown' && STATUS_SEVERITY[s.kmStatus] > STATUS_SEVERITY[s.dateStatus]) {
    title = `${label} tra ${new Intl.NumberFormat('it-IT').format(Math.max(0, s.kmRemaining))} km`;
  } else {
    title = dueText(label, s.daysRemaining);
  }
  return { ...base, status: s.status, date: s.nextDate, days: s.daysRemaining, overdueDays, title };
}

/**
 * Stato di un pagamento non saldato per il giardino: conta solo dall'ultima settimana.
 * Una rata o bolletta che scade tra settimane è normale amministrazione, non una sofferenza.
 */
export function paymentGardenStatus(dueDate, today) {
  const st = deadlineStatus(dueDate, today);
  return st === 'warning' ? 'ok' : st;
}

const BILL_LABEL = { luce: 'Luce', gas: 'Gas', internet: 'Internet', acqua: 'Acqua', rifiuti: 'Rifiuti', altro: 'Altro' };

/** Affitto e bollette: rate e bollette non pagate. */
export function rentIssues(data, today) {
  const out = [];
  for (const r of live(data.rentInstallments)) {
    if (r.paidAt || !r.dueDate) continue;
    out.push(dateIssue({ key: `rent:${r.id}`, plant: 'affitto', label: `Rata di ${formatPeriod(r.periodKey)}`, fem: true,
      date: r.dueDate, today, href: '#/casa', status: paymentGardenStatus(r.dueDate, today) }));
  }
  for (const b of live(data.bills)) {
    if (b.paidAt || !b.dueDate) continue;
    out.push(dateIssue({ key: `bill:${b.id}`, plant: 'affitto', label: `Bolletta ${(BILL_LABEL[b.kind] ?? '').toLowerCase()}`.trim(), fem: true,
      date: b.dueDate, today, href: '#/casa', status: paymentGardenStatus(b.dueDate, today) }));
  }
  return out;
}

/** Manutenzioni di casa rispetto all'intervallo. */
export function maintenanceIssues(data, today) {
  const out = [];
  for (const m of live(data.homeMaintenance)) {
    const next = maintenanceNextDate(m);
    if (!next) {
      out.push({ key: `maintenance:${m.id}`, plant: 'manutenzioni', status: 'unknown', date: null, days: null, overdueDays: 0,
        title: `${m.title}: ultima esecuzione da inserire`, href: '#/casa' });
      continue;
    }
    const days = daysBetween(today, next);
    const status = deadlineStatus(next, today);
    const title = days < 0 ? `${m.title} in ritardo di ${-days} ${plural(-days, 'giorno', 'giorni')}` : dueText(m.title, days, false).replace(' scade ', ' da fare ');
    out.push({ key: `maintenance:${m.id}`, plant: 'manutenzioni', status, date: next, days, overdueDays: status === 'overdue' ? -days : 0, title, href: '#/casa' });
  }
  return out;
}

/** Spesa: articoli urgenti aperti (ambra), urgenti da più di 2 giorni (rosso). */
export function groceryIssues(data, now) {
  const out = [];
  const nowMs = new Date(now).getTime();
  for (const item of live(data.groceryItems)) {
    if (item.archived || item.checkedAt) continue;
    const glow = urgencyGlow(item, now);
    if (!glow) continue;
    const hours = Math.max(0, Math.floor((nowMs - Date.parse(item.addedAt)) / 3_600_000));
    const days = Math.floor(hours / 24);
    const since = days >= 1 ? `da ${days} ${plural(days, 'giorno', 'giorni')}` : 'da oggi';
    out.push({ key: `grocery:${item.id}`, plant: 'spesa', status: glow, date: toDateKey(item.addedAt), days: -days, overdueDays: 0,
      title: `${item.name} urgente ${since}`, href: '#/spesa' });
  }
  return out;
}

/** Giorni entro cui una visita senza note di preparazione inizia a contare. */
export const VISIT_PREP_DAYS = 7;

/**
 * Salute: visite entro 7 giorni senza note di preparazione (warning, critical entro 2 giorni)
 * e richiami di vaccino scaduti o vicini (stati standard).
 * Ogni causa ha anche `maskedTitle` per quando il blocco Salute è attivo.
 */
export function healthIssues(data, today) {
  const out = [];
  for (const v of live(data.medicalVisits)) {
    if (!v.dateTime) continue;
    const date = toDateKey(v.dateTime);
    const days = daysBetween(today, date);
    if (days < 0 || days > VISIT_PREP_DAYS || String(v.notes || '').trim()) continue;
    const when = days === 0 ? 'oggi' : days === 1 ? 'domani' : `tra ${days} giorni`;
    out.push({ key: `visit:${v.id}`, plant: 'salute', status: days <= 2 ? 'critical' : 'warning', date, days, overdueDays: 0,
      title: `Visita ${v.type || 'medica'} ${when}, senza preparazione`, maskedTitle: `Visita ${when}, senza preparazione`, href: '#/salute' });
  }
  for (const v of live(data.vaccines)) {
    if (!v.boosterDate) continue;
    const issue = dateIssue({ key: `vaccine:${v.id}`, plant: 'salute', label: `Richiamo ${v.name}`, date: v.boosterDate, today, href: '#/salute' });
    issue.maskedTitle = dueText('Richiamo vaccino', issue.days);
    out.push(issue);
  }
  return out;
}

/**
 * Backup: ok entro la soglia, poi warning fino a 2× la soglia, critical fino a 3×, poi overdue.
 * Nessun pacchetto mai scaricato (con dati presenti) = critical.
 */
export function backupIssues({ lastBackupAt, thresholdDays = 30 }, today) {
  const t = Number(thresholdDays) > 0 ? Number(thresholdDays) : 30;
  if (!lastBackupAt) {
    return [{ key: 'backup:never', plant: 'backup', status: 'critical', date: null, days: null, overdueDays: 0,
      title: 'Nessun pacchetto di backup scaricato', href: '#/impostazioni' }];
  }
  const date = toDateKey(lastBackupAt);
  const age = daysBetween(date, today);
  let status = 'ok';
  if (age > 3 * t) status = 'overdue';
  else if (age > 2 * t) status = 'critical';
  else if (age > t) status = 'warning';
  const title = age <= 0 ? 'Ultimo backup oggi' : `Ultimo backup ${age} ${plural(age, 'giorno', 'giorni')} fa`;
  return [{ key: 'backup:last', plant: 'backup', status, date, days: -age, overdueDays: status === 'overdue' ? age - 3 * t : 0, title, href: '#/impostazioni' }];
}

/**
 * Tutto il giardino.
 * @param {object} data record per entità (come loadEntities)
 * @param {{ today: string, now: string|Date, settings?: { lastBackupAt?: string, backupReminderDays?: number } }} opts
 * @returns {{ plants: Array<object>, hasData: boolean, healthy: number, withData: number }}
 */
export function gardenState(data, { today, now, settings = {} }) {
  const d = data || {};
  const any = (...keys) => keys.some((k) => live(d[k]).length > 0);
  const hasAuto = any('vehicles');
  const hasRent = any('rentContracts', 'rentInstallments', 'bills');
  const hasMaint = any('homeMaintenance');
  const hasSpesa = any('groceryItems', 'groceryPurchases');
  const hasSalute = any('medicalVisits', 'vaccines');
  const hasAnything = hasAuto || hasRent || hasMaint || hasSpesa || hasSalute || any('homePurchases');

  const plants = [
    buildPlant('auto', hasAuto ? autoIssues(d, today) : [], hasAuto),
    buildPlant('affitto', hasRent ? rentIssues(d, today) : [], hasRent),
    buildPlant('manutenzioni', hasMaint ? maintenanceIssues(d, today) : [], hasMaint),
    buildPlant('spesa', hasSpesa ? groceryIssues(d, now) : [], hasSpesa),
    buildPlant('salute', hasSalute ? healthIssues(d, today) : [], hasSalute),
    buildPlant('backup', hasAnything ? backupIssues({ lastBackupAt: settings.lastBackupAt, thresholdDays: settings.backupReminderDays }, today) : [], hasAnything),
  ];
  const withData = plants.filter((p) => p.hasData).length;
  const healthy = plants.filter((p) => p.hasData && (p.stage.id === 'fiorita' || p.stage.id === 'sana')).length;
  return { plants, hasData: hasAnything, healthy, withData };
}
