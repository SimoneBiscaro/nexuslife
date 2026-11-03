import { html } from '../../ui/html.js';
import { PageHeader } from '../../ui/Page.js';
import { GlassCard } from '../../ui/GlassCard.js';
import { HudGauge } from '../../ui/HudGauge.js';
import { Banner } from '../../ui/Banner.js';
import { NeonBadge } from '../../ui/NeonBadge.js';
import { Icon } from '../../ui/icons.js';
import { formatDueDate, formatEuro, formatWeekdayDate } from '../../ui/format.js';
import { ALL_SECTION_ENTITIES, useEntities } from '../../store/queries.js';
import { updateSettings } from '../../store/settings.js';
import { DEFAULT_SETTINGS } from '../../store/seed.js';
import { navigate } from '../../router.js';
import { toDateKey } from '../../domain/dates.js';
import { dismissBanner, todayBanners } from '../../domain/deadlines.js';
import { backupReminder, collectDeadlines, daysLabel, greeting, upcomingDeadlines, vehicleOverview } from '../../domain/overview.js';
import { vehicleGauges } from '../auto/gauges.js';
import { useSignal } from '../../store/state.js';
import { unlocked } from '../../store/lock.js';
import { activeContract, currentInstallment, homePurchasesTotal, paymentBadge } from '../../domain/home.js';
import { urgencyGlow } from '../../domain/groceries.js';
import { suggestGroceries } from '../../domain/suggestions.js';

const SECTION_ICON = { auto: 'auto', casa: 'casa', spesa: 'spesa', salute: 'salute' };

function SummaryCard({ section, title, accent, index, children }) {
  return html`
    <${GlassCard} interactive onClick=${() => navigate(`/${section}`)} class="summary spring-in"
      style=${`--i:${index};--accent:${accent}`} aria-label=${`${title}: apri la sezione`}>
      <span class="summary__head">
        <span class="summary__icon" aria-hidden="true"><${Icon} name=${SECTION_ICON[section]} /></span>
        <span class="summary__title">${title}</span>
        <span class="summary__go" aria-hidden="true"><${Icon} name="back" /></span>
      </span>
      ${children}
    <//>`;
}

const Placeholder = () => html`<span class="summary__placeholder">Si attiva quando aggiungi dati</span>`;

export function OggiView() {
  const now = new Date();
  const today = toDateKey(now);
  const { data } = useEntities(ALL_SECTION_ENTITIES);

  const settings = { ...DEFAULT_SETTINGS, ...(data?.settings?.[0] || {}) };
  const healthOpen = useSignal(unlocked);
  // Con il blocco attivo, fuori da Salute non compaiono dettagli sanitari.
  const maskHealth = settings.healthLockEnabled !== false && !healthOpen;
  const items = (data ? collectDeadlines(data, today) : []).map((i) => (maskHealth && i.section === 'salute'
    ? { ...i, title: i.kind === 'visita' ? 'Visita medica' : 'Richiamo vaccino' } : i));
  const banners = todayBanners(items, { today, now, dismissed: settings.dismissedBanners || {} });
  const upcoming = upcomingDeadlines(items, 5);
  const vehicle = data?.vehicles.slice().sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))[0];
  const gauges = vehicle
    ? vehicleGauges(vehicleOverview(vehicle, { deadlines: data.vehicleDeadlines, readings: data.mileageReadings }, today), vehicle, today)
    : [];

  const salute = items.filter((i) => i.section === 'salute').sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  const openItems = (data?.groceryItems || []).filter((i) => !i.archived && !i.checkedAt);
  const urgent = openItems.filter((i) => urgencyGlow(i, now)).length;
  const suggested = data ? suggestGroceries({
    purchases: data.groceryPurchases, openItems: data.groceryItems.filter((i) => !i.archived), feedback: data.suggestionFeedback, today,
  }).length : 0;
  const contract = data ? activeContract(data.rentContracts) : null;
  const rentNow = contract ? currentInstallment(data.rentInstallments, contract.id, today) : null;
  const rentBadge = rentNow && paymentBadge(rentNow, today);
  const nextCasa = items.filter((i) => i.section === 'casa' && i.kind !== 'affitto').sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  const toBuy = data ? data.homePurchases.filter((i) => !i.done).length : 0;
  const toBuyTotal = data ? homePurchasesTotal(data.homePurchases) : 0;
  const hasCasa = Boolean(rentNow || nextCasa || toBuy);

  const hasData = Boolean(data && ['vehicles', 'bills', 'rentContracts', 'groceryItems', 'groceryPurchases', 'medicalVisits', 'vaccines', 'homeMaintenance']
    .some((k) => data[k]?.length));
  const backup = data ? backupReminder({ lastBackupAt: settings.lastBackupAt, thresholdDays: Number(settings.backupReminderDays) || 30, hasData }, today) : null;
  const showBackup = backup && !(settings.dismissedBanners?.[backup.key] && Date.parse(settings.dismissedBanners[backup.key]) > now.getTime());

  const hide = (key) => updateSettings({ dismissedBanners: dismissBanner(settings.dismissedBanners, key, new Date()) });

  return html`
    <${PageHeader} eyebrow="Oggi" docTitle="Oggi" title=${`${greeting(now.getHours())}${settings.profileName ? `, ${settings.profileName}` : ''}`} lede=${html`<span class="today-date">${formatWeekdayDate(today)}</span>`} />

    ${(banners.length > 0 || showBackup) && html`
      <section class="stack banners" aria-label="Avvisi">
        ${showBackup && html`<${Banner} key=${backup.key} status="warning" title=${backup.title} onDismiss=${() => hide(backup.key)}>
          ${backup.text} <a class="inline-link" href="#/impostazioni">Vai al backup</a>
        <//>`}
        ${banners.map((b) => html`
          <${Banner} key=${b.key} status=${b.status} title=${b.title}
            badge=${html`<${NeonBadge} status=${b.status}>${daysLabel(b.days)}<//>`}
            onDismiss=${() => hide(b.key)}>
            ${b.status === 'overdue' ? `Scaduto ${formatDueDate(b.date, today)}` : `Scade ${formatDueDate(b.date, today)}`}
          <//>`)}
      </section>`}

    <section class="summary-grid" aria-label="Riepilogo delle sezioni">
      <${SummaryCard} section="auto" title="Auto" accent="var(--electric-blue-glow)" index=${0}>
        ${vehicle
          ? html`<span class="summary__gauges">
              ${gauges.map((g) => html`<${HudGauge} key=${g.key} value=${g.value} unit="" label=${g.label} ratio=${g.ratio} status=${g.status} size=${76} />`)}
            </span>`
          : html`<span class="summary__placeholder">Aggiungi la tua auto per vedere le scadenze</span>`}
      <//>
      <${SummaryCard} section="casa" title="Casa" accent="var(--mint)" index=${1}>
        ${hasCasa
          ? html`<span class="summary__lines">
              ${rentNow && html`<span class="summary__line">Affitto ${formatEuro(rentNow.amount)} <${NeonBadge} status=${rentBadge.status}>${rentBadge.label}<//></span>`}
              ${nextCasa && html`<span class="summary__sub">${nextCasa.title} · ${daysLabel(nextCasa.days)}</span>`}
              ${toBuy > 0 && html`<span class="summary__sub">${toBuy} da comprare${toBuyTotal ? ` · ${formatEuro(toBuyTotal)}` : ''}</span>`}
            </span>`
          : html`<${Placeholder} />`}
      <//>
      <${SummaryCard} section="spesa" title="Spesa" accent="var(--amber)" index=${2}>
        ${openItems.length || suggested
          ? html`<span class="summary__lines">
              <span class="summary__line">${openItems.length === 1 ? '1 articolo' : `${openItems.length} articoli`} in lista</span>
              ${urgent > 0 && html`<span class="summary__sub"><${NeonBadge} status="warning">${urgent === 1 ? '1 urgente' : `${urgent} urgenti`}<//></span>`}
              ${suggested > 0 && html`<span class="summary__sub">${suggested === 1 ? '1 suggerimento' : `${suggested} suggerimenti`} per te</span>`}
            </span>`
          : html`<${Placeholder} />`}
      <//>
      <${SummaryCard} section="salute" title="Salute" accent="var(--health)" index=${3}>
        ${salute ? html`<span class="summary__line">${salute.title} · ${daysLabel(salute.days)}</span>` : html`<${Placeholder} />`}
      <//>
    </section>

    <h2 class="section-title">Prossime scadenze</h2>
    ${upcoming.length === 0
      ? html`<p class="card-text">Nessuna scadenza registrata. Aggiungi l'auto o i dati di casa per vederle qui.</p>`
      : html`<${GlassCard} class="spring-in" style="--i:4">
          <ul class="item-list">
            ${upcoming.map((u) => html`
              <li key=${u.key}>
                <a class="item-row" href=${u.href}>
                  <span class="item-row__icon" data-status=${u.status} aria-hidden="true"><${Icon} name=${SECTION_ICON[u.section]} /></span>
                  <span class="item-row__main">
                    <span class="item-row__title">${u.title}</span>
                    <span class="item-row__meta">${formatDueDate(u.date, today).replace(/^(il |l')/, '')}</span>
                  </span>
                  <${NeonBadge} status=${u.status}>${daysLabel(u.days)}<//>
                </a>
              </li>`)}
          </ul>
        <//>`}`;
}
