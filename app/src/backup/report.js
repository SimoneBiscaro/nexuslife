/*
 * riepilogo.html: pagina autonoma e stampabile (stile chiaro) con lo stato al giorno del pacchetto.
 */
import { formatDateKey, formatPeriod } from '../domain/dates.js';
import { DEADLINE_LABEL, DEADLINE_TYPES, vehicleOverview } from '../domain/overview.js';
import { BILL_KIND_LABEL, billTotals, maintenanceState, sortHomePurchases } from '../domain/home.js';
import { paymentStatus } from '../domain/rent.js';
import { deadlineStatus } from '../domain/deadlines.js';
import { STATUS_IT, splitVisits } from '../domain/health.js';

const eur = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
const int = new Intl.NumberFormat('it-IT');
const dt = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'long', timeStyle: 'short' });

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const e = escapeHtml;
const d = (key) => (key ? formatDateKey(key) : '—');
const money = (n) => (n === null || n === undefined || n === '' ? '—' : eur.format(Number(n)));
const PAY = { paid: 'Pagato', overdue: 'In ritardo', pending: 'In attesa' };

function table(headers, rows, empty) {
  if (!rows.length) return `<p class="empty">${e(empty)}</p>`;
  return `<table><thead><tr>${headers.map((h) => `<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${
    rows.map((r) => `<tr>${r.map((c, i) => `<td${i && /^[\d.,\s€−-]+$/.test(String(c)) ? ' class="n"' : ''}>${c}</td>`).join('')}</tr>`).join('')
  }</tbody></table>`;
}

const badge = (status) => `<span class="b b-${status}">${e(STATUS_IT[status] ?? status)}</span>`;

/**
 * @param {Array<object>} records record esportati (non eliminati)
 * @param {{ today: string, now: string, appVersion: string, excludeHealth?: boolean }} opts
 */
export function buildReport(records, { today, now, appVersion, excludeHealth = false }) {
  const of = (entity) => records.filter((r) => r.entity === entity && !r.deleted);
  const year = today.slice(0, 4);
  const sections = [];

  // Auto
  const vehicles = of('vehicle');
  const autoParts = vehicles.map((v) => {
    const ov = vehicleOverview(v, { deadlines: of('vehicleDeadline'), readings: of('mileageReading') }, today);
    const rows = DEADLINE_TYPES.map((t) => {
      const x = ov.deadlines[t];
      return [e(DEADLINE_LABEL[t]), d(x?.record.dueDate), badge(x?.status ?? 'unknown'), money(x?.record.amount)];
    });
    const s = ov.service;
    rows.push(['Tagliando', d(s.nextDate) + (s.nextKm ? ` · ${int.format(s.nextKm)} km` : ''), badge(s.status), '—']);
    return `<h3>${e(v.name)} ${v.plate ? `<small>${e(v.plate)}</small>` : ''}</h3>
      <p>Chilometri attuali: <strong>${int.format(ov.currentKm)} km</strong> · media ${int.format(Math.round(ov.kmPerDay.kmPerDay))} km/giorno${ov.kmPerDay.generic ? ' (stima generica)' : ''}</p>
      ${table(['Scadenza', 'Data', 'Stato', 'Importo'], rows, '')}`;
  });
  sections.push(`<section><h2>Auto</h2>${autoParts.join('') || '<p class="empty">Nessun veicolo.</p>'}</section>`);

  // Casa
  const installments = of('rentInstallment').filter((i) => i.periodKey?.startsWith(year)).sort((a, b) => (a.periodKey < b.periodKey ? -1 : 1));
  const bills = of('bill').filter((b) => b.dueDate?.startsWith(year)).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  const totals = billTotals(bills, year);
  const maint = of('homeMaintenance').map((m) => ({ m, ...maintenanceState(m, today) }));
  sections.push(`<section><h2>Casa</h2>
    <h3>Affitto ${year}</h3>
    ${table(['Mese', 'Scadenza', 'Importo', 'Stato'], installments.map((i) => [e(formatPeriod(i.periodKey)), d(i.dueDate), money(i.amount), e(PAY[paymentStatus(i, today)])]), 'Nessuna rata registrata.')}
    <h3>Bollette ${year} <small>totale ${money(totals.total)}</small></h3>
    ${table(['Tipo', 'Fornitore', 'Scadenza', 'Importo', 'Stato'], bills.map((b) => [e(BILL_KIND_LABEL[b.kind] ?? b.kind), e(b.provider || '—'), d(b.dueDate), money(b.amount), e(PAY[paymentStatus(b, today)])]), 'Nessuna bolletta registrata.')}
    <h3>Manutenzioni</h3>
    ${table(['Cosa', 'Ogni', 'Ultima', 'Prossima', 'Stato'], maint.map((x) => [e(x.m.title), `${x.m.intervalMonths} mesi`, d(x.m.lastDoneDate), d(x.nextDate), badge(x.status)]), 'Nessuna manutenzione registrata.')}
    <h3>Da comprare per la casa</h3>
    ${table(['Cosa', 'Priorità', 'Prezzo stimato'], sortHomePurchases(of('homePurchase')).filter((p) => !p.done).map((p) => [e(p.name), e(p.priority), money(p.estimatedPrice)]), 'Niente da comprare.')}
  </section>`);

  // Spesa
  const cats = new Map(of('groceryCategory').map((c) => [c.id, c.name]));
  const open = of('groceryItem').filter((i) => !i.archived);
  sections.push(`<section><h2>Lista della spesa aperta</h2>
    ${table(['Articolo', 'Quantità', 'Urgenza', 'Categoria'], open.map((i) => [e(i.name), String(i.quantity ?? 1), e(i.urgency), e(cats.get(i.categoryId) ?? '—')]), 'La lista è vuota.')}
  </section>`);

  // Salute
  if (!excludeHealth) {
    const { upcoming } = splitVisits(of('medicalVisit'), now);
    const vaccines = of('vaccine').sort((a, b) => (a.date < b.date ? 1 : -1));
    sections.push(`<section><h2>Salute</h2>
      <h3>Prossime visite</h3>
      ${table(['Quando', 'Tipo', 'Medico', 'Dove'], upcoming.map((v) => [e(dt.format(new Date(v.dateTime))), e(v.type), e(v.doctor || '—'), e(v.place || '—')]), 'Nessuna visita in programma.')}
      <h3>Libretto vaccini</h3>
      ${table(['Vaccino', 'Data', 'Lotto', 'Richiamo', 'Stato richiamo'], vaccines.map((v) => [e(v.name), d(v.date), e(v.lot || '—'), d(v.boosterDate), v.boosterDate ? badge(deadlineStatus(v.boosterDate, today)) : '—']), 'Nessun vaccino registrato.')}
    </section>`);
  }

  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>NexusLife · riepilogo del ${e(formatDateKey(today))}</title>
<style>
  :root { color-scheme: light; }
  body { font: 14px/1.5 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1d1d1f; background: #fff; margin: 0 auto; max-width: 860px; padding: 32px 24px; }
  header { border-bottom: 2px solid #9C8355; padding-bottom: 12px; margin-bottom: 8px; }
  h1 { font: 600 28px/1.2 Georgia, "Times New Roman", serif; margin: 0; }
  h2 { font: 600 20px/1.3 Georgia, "Times New Roman", serif; margin: 28px 0 8px; color: #5c4a2a; }
  h3 { font-size: 15px; margin: 18px 0 6px; } h3 small, h2 small { font-weight: 400; color: #6e6e73; }
  .meta { color: #6e6e73; margin: 4px 0 0; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e5e5ea; vertical-align: top; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #6e6e73; }
  td.n { text-align: right; font-variant-numeric: tabular-nums; }
  .empty { color: #6e6e73; font-style: italic; }
  .b { display: inline-block; padding: 1px 8px; border-radius: 99px; font-size: 11px; font-weight: 700; border: 1px solid; }
  .b-ok { color: #11734b; } .b-warning { color: #8a5a00; } .b-critical, .b-overdue { color: #b3261e; } .b-unknown { color: #6e6e73; }
  footer { margin-top: 32px; color: #6e6e73; font-size: 12px; }
  @media print { body { padding: 0; } section { break-inside: avoid-page; } h2 { break-after: avoid; } }
</style></head>
<body>
<header><h1>NexusLife · riepilogo</h1>
<p class="meta">Stato al ${e(formatDateKey(today))} · generato il ${e(dt.format(new Date(now)))} · app ${e(appVersion)}${excludeHealth ? ' · senza dati sanitari' : ''}</p></header>
${sections.join('\n')}
<footer>Pacchetto generato da NexusLife sul tuo dispositivo. Per ripristinare i dati usa il file nexuslife.json.</footer>
</body></html>`;
}

