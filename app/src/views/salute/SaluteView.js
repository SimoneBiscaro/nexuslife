import { useEffect, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { PageHeader, EmptyState, EmptyNote, Skeleton } from '../../ui/Page.js';
import { GlassCard } from '../../ui/GlassCard.js';
import { NeonBadge } from '../../ui/NeonBadge.js';
import { Icon } from '../../ui/icons.js';
import { formatDueDate } from '../../ui/format.js';
import { useEntities } from '../../store/queries.js';
import { useSignal } from '../../store/state.js';
import { checkTimeout, hasPin, unlocked } from '../../store/lock.js';
import { DEFAULT_SETTINGS } from '../../store/seed.js';
import { daysBetween, toDateKey } from '../../domain/dates.js';
import { boosterStatus, countdown, openVisitPlans, sortVaccines, splitVisits, visitPlanLabel } from '../../domain/health.js';
import { daysLabel } from '../../domain/overview.js';
import { LockScreen, PinSetup } from './LockScreen.js';
import { VisitSheet } from './VisitSheet.js';
import { VaccineSheet } from './VaccineSheet.js';
import { VisitPlanSheet } from './VisitPlanSheet.js';
import { ProgressiveList } from '../../ui/incremental.js';
import { memo } from '../../ui/memo.js';

const ENTITIES = ['medicalVisit', 'vaccine', 'visitPlan', 'settings'];
const when = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const shortWhen = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const cap = (s) => s[0].toUpperCase() + s.slice(1);

const VisitRow = memo(function VisitRow({ v, onOpen }) {
  return html`<li>
    <button class="item-row" type="button" onClick=${() => onOpen(v)}>
      <span class="item-row__icon" style="--status-color:var(--health);--status-text:var(--health)" aria-hidden="true"><${Icon} name="stethoscope" /></span>
      <span class="item-row__main">
        <span class="item-row__title">${cap(v.type)}${v.doctor ? ` · ${v.doctor}` : ''}</span>
        <span class="item-row__meta">${shortWhen.format(new Date(v.dateTime))}${v.place ? ` · ${v.place}` : ''}</span>
      </span>
    </button></li>`;
});

const VaccineRow = memo(function VaccineRow({ v, today, onOpen }) {
  const st = boosterStatus(v, today);
  return html`<li>
    <button class="item-row" type="button" onClick=${() => onOpen(v)}>
      <span class="item-row__icon" style="--status-color:var(--health);--status-text:var(--health)" aria-hidden="true"><${Icon} name="syringe" /></span>
      <span class="item-row__main">
        <span class="item-row__title">${v.name}</span>
        <span class="item-row__meta">fatto ${formatDueDate(v.date, today)}${v.lot ? ` · lotto ${v.lot}` : ''}${v.boosterDate ? ` · richiamo ${formatDueDate(v.boosterDate, today)}` : ''}</span>
      </span>
      ${st && st !== 'ok' && html`<${NeonBadge} status=${st}>${st === 'overdue' ? 'richiamo scaduto' : `richiamo ${daysLabel(daysBetween(today, v.boosterDate))}`}<//>`}
    </button></li>`;
});

const PlanRow = memo(function PlanRow({ x, today, onOpen }) {
  const booked = x.state === 'prenotata';
  return html`<li>
    <button class="item-row" type="button" onClick=${() => onOpen(x.plan)}>
      <span class="item-row__icon" data-status=${booked ? 'ok' : x.status} aria-hidden="true"><${Icon} name=${booked ? 'check' : 'calendar'} /></span>
      <span class="item-row__main">
        <span class="item-row__title">${visitPlanLabel(x.plan)}</span>
        <span class="item-row__meta">${booked ? `prenotata per ${shortWhen.format(new Date(x.booked.dateTime))}`
          : x.dueBy ? `da prenotare entro ${formatDueDate(x.dueBy, today)}` : 'da prenotare, senza data'}</span>
      </span>
      <${NeonBadge} status=${booked ? 'ok' : x.status}>${booked ? 'prenotata' : x.dueBy ? daysLabel(x.days) : 'da fare'}<//>
    </button></li>`;
});

function PlansCard({ plans, today, onPlan }) {
  return html`
    <${GlassCard} class="spring-in" style="--i:1">
      <div class="card-head">
        <h2 class="card-title">Da prenotare</h2>
        <button class="btn btn--secondary" type="button" onClick=${() => onPlan(null)}><${Icon} name="plus" /> Aggiungi</button>
      </div>
      ${plans.length
        ? html`<ul class="item-list">${plans.map((x) => html`<${PlanRow} key=${x.plan.id} x=${x} today=${today} onOpen=${onPlan} />`)}</ul>`
        : html`<${EmptyNote} art="visite" accent="var(--health)">Visite da prenotare, una volta o periodiche (es. dentista ogni 6 mesi): ti ricordiamo quando chiamare.<//>`}
    <//>`;
}

function HealthContent({ data, now, today, onVisit, onVaccine, onPlan }) {
  const { upcoming, past } = splitVisits(data.medicalVisits, now);
  const vaccines = sortVaccines(data.vaccines);
  const plans = openVisitPlans(data.visitPlans, data.medicalVisits, now);
  const next = upcoming[0];
  if (!upcoming.length && !past.length && !vaccines.length && !plans.length && !data.visitPlans.length) {
    return html`<${EmptyState} art="visite" accent="var(--health)" title="Nessuna visita in programma"
      text="Aggiungi visite mediche e vaccini: ti ricorderemo appuntamenti e richiami.">
      <div class="empty-actions">
        <button class="btn btn--primary" type="button" onClick=${() => onVisit(null)}><${Icon} name="plus" /> Aggiungi una visita</button>
        <button class="btn btn--secondary" type="button" onClick=${() => onVaccine(null)}><${Icon} name="syringe" /> Aggiungi un vaccino</button>
        <button class="btn btn--secondary" type="button" onClick=${() => onPlan(null)}><${Icon} name="calendar" /> Da prenotare</button>
      </div>
    <//>`;
  }
  const cd = next && countdown(next.dateTime, now);
  return html`
    ${next && html`
      <${GlassCard} interactive onClick=${() => onVisit(next)} class="countdown spring-in" style="--i:0" aria-label=${`Prossima visita: ${next.type}, ${cd.label}`}>
        <span class="countdown__eyebrow">Prossima visita</span>
        <span class="countdown__value">${cd.label}</span>
        <span class="countdown__what">${cap(next.type)}${next.doctor ? ` · ${next.doctor}` : ''}</span>
        <span class="countdown__when">${when.format(new Date(next.dateTime))}${next.place ? ` · ${next.place}` : ''}</span>
      <//>`}
    <div class="salute-grid">
      <${PlansCard} plans=${plans} today=${today} onPlan=${onPlan} />
      <${GlassCard} class="spring-in" style="--i:2">
        <div class="card-head">
          <h2 class="card-title">Visite</h2>
          <button class="btn btn--secondary" type="button" onClick=${() => onVisit(null)} aria-keyshortcuts="N"><${Icon} name="plus" /> Aggiungi</button>
        </div>
        <h3 class="subhead">Prossime</h3>
        ${upcoming.length ? html`<${ProgressiveList} class="item-list" items=${upcoming} renderItem=${(v) => html`<${VisitRow} key=${v.id} v=${v} onOpen=${onVisit} />`} />`
          : html`<${EmptyNote} art="visite" accent="var(--health)">Nessuna visita in programma: aggiungila e ti ricorderemo 24 e 2 ore prima.<//>`}
        <h3 class="subhead">Passate</h3>
        ${past.length ? html`<ul class="item-list">${past.slice(0, 12).map((v) => html`<${VisitRow} key=${v.id} v=${v} onOpen=${onVisit} />`)}</ul>`
          : html`<p class="card-text">Ancora nessuna visita passata.</p>`}
      <//>
      <${GlassCard} class="spring-in" style="--i:3">
        <div class="card-head">
          <h2 class="card-title">Libretto vaccini</h2>
          <button class="btn btn--secondary" type="button" onClick=${() => onVaccine(null)}><${Icon} name="plus" /> Aggiungi</button>
        </div>
        ${vaccines.length === 0 ? html`<${EmptyNote} art="vaccini" accent="var(--health)">Nessun vaccino registrato. Con la data del richiamo ti avvisiamo 30 e 7 giorni prima.<//>` : html`
          <${ProgressiveList} class="item-list" items=${vaccines} renderItem=${(v) => html`<${VaccineRow} key=${v.id} v=${v} today=${today} onOpen=${onVaccine} />`} />`}
      <//>
    </div>`;
}

export function SaluteView() {
  const now = new Date();
  const today = toDateKey(now);
  const { data, error } = useEntities(ENTITIES);
  const isUnlocked = useSignal(unlocked);
  const [pinSet, setPinSet] = useState(null);
  const [visit, setVisit] = useState(undefined);
  const [vaccine, setVaccine] = useState(undefined);
  const [plan, setPlan] = useState(undefined); // visita da prenotare aperta
  const [booking, setBooking] = useState(null); // visita da prenotare da cui nasce la nuova visita
  const [, tick] = useState(0);

  const settings = { ...DEFAULT_SETTINGS, ...(data?.settings?.[0] || {}) };
  const lockEnabled = settings.healthLockEnabled !== false;
  const locked = lockEnabled && (!isUnlocked || pinSet === false);

  useEffect(() => { hasPin().then(setPinSet).catch(() => setPinSet(false)); }, [isUnlocked]);

  // Ricontrolla il timeout e aggiorna il conto alla rovescia ogni 15 secondi.
  useEffect(() => {
    checkTimeout();
    const id = setInterval(() => { checkTimeout(); tick((n) => n + 1); }, 15_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onNew = () => { if (!locked) setVisit(null); };
    window.addEventListener('nexus:new', onNew);
    return () => window.removeEventListener('nexus:new', onNew);
  }, [locked]);

  const header = html`<${PageHeader} eyebrow="Visite e vaccini" title="Salute" />`;
  if (error) {
    return html`${header}<${EmptyState} icon="alert" title="Archivio non disponibile"
      text="Questo browser non permette di salvare dati (per esempio in navigazione privata)." />`;
  }
  if (!data || (lockEnabled && pinSet === null)) return html`${header}<${Skeleton} cards=${2} label="Caricamento di Salute" />`;

  return html`
    ${header}
    <div class="health" data-locked=${locked ? 'true' : 'false'}>
      <div class="health__content" inert=${locked} aria-hidden=${locked ? 'true' : undefined}>
        <${HealthContent} data=${data} now=${now} today=${today} onVisit=${(v) => { setBooking(null); setVisit(v); }} onVaccine=${setVaccine} onPlan=${setPlan} />
      </div>
      ${locked && html`<div class="health__lock">${pinSet ? html`<${LockScreen} />` : html`<${PinSetup} onDone=${() => setPinSet(true)} />`}</div>`}
    </div>
    ${!locked && html`
      <${VisitSheet} open=${visit !== undefined} visit=${visit || null} plan=${booking} plans=${data.visitPlans}
        onClose=${() => { setVisit(undefined); setBooking(null); }} />
      <${VisitPlanSheet} open=${plan !== undefined} plan=${plan || null} today=${today}
        state=${plan ? openVisitPlans([plan], data.medicalVisits, now)[0] : null}
        onClose=${() => setPlan(undefined)} onBook=${(p) => { setPlan(undefined); setBooking(p); setVisit(null); }} />
      <${VaccineSheet} open=${vaccine !== undefined} vaccine=${vaccine || null} today=${today} onClose=${() => setVaccine(undefined)} />`}`;
}
