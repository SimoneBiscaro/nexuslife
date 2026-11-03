import { useEffect, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { PageHeader, EmptyState } from '../../ui/Page.js';
import { GlassCard } from '../../ui/GlassCard.js';
import { NeonBadge } from '../../ui/NeonBadge.js';
import { Icon } from '../../ui/icons.js';
import { formatDueDate } from '../../ui/format.js';
import { useEntities } from '../../store/queries.js';
import { useSignal } from '../../store/state.js';
import { checkTimeout, hasPin, unlocked } from '../../store/lock.js';
import { DEFAULT_SETTINGS } from '../../store/seed.js';
import { daysBetween, toDateKey } from '../../domain/dates.js';
import { boosterStatus, countdown, sortVaccines, splitVisits } from '../../domain/health.js';
import { daysLabel } from '../../domain/overview.js';
import { LockScreen, PinSetup } from './LockScreen.js';
import { VisitSheet } from './VisitSheet.js';
import { VaccineSheet } from './VaccineSheet.js';

const ENTITIES = ['medicalVisit', 'vaccine', 'settings'];
const when = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const shortWhen = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const cap = (s) => s[0].toUpperCase() + s.slice(1);

function VisitRow({ v, onOpen }) {
  return html`<li>
    <button class="item-row" type="button" onClick=${() => onOpen(v)}>
      <span class="item-row__icon" style="--status-color:var(--health);--status-text:var(--health)" aria-hidden="true"><${Icon} name="stethoscope" /></span>
      <span class="item-row__main">
        <span class="item-row__title">${cap(v.type)}${v.doctor ? ` · ${v.doctor}` : ''}</span>
        <span class="item-row__meta">${shortWhen.format(new Date(v.dateTime))}${v.place ? ` · ${v.place}` : ''}</span>
      </span>
    </button></li>`;
}

function HealthContent({ data, now, today, onVisit, onVaccine }) {
  const { upcoming, past } = splitVisits(data.medicalVisits, now);
  const vaccines = sortVaccines(data.vaccines);
  const next = upcoming[0];
  if (!upcoming.length && !past.length && !vaccines.length) {
    return html`<${EmptyState} icon="salute" accent="var(--health)" title="Nessuna visita in programma"
      text="Aggiungi visite mediche e vaccini: ti ricorderemo appuntamenti e richiami.">
      <div class="empty-actions">
        <button class="btn btn--primary" type="button" onClick=${() => onVisit(null)}><${Icon} name="plus" /> Aggiungi una visita</button>
        <button class="btn btn--secondary" type="button" onClick=${() => onVaccine(null)}><${Icon} name="syringe" /> Aggiungi un vaccino</button>
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
      <${GlassCard} class="spring-in" style="--i:1">
        <div class="card-head">
          <h2 class="card-title">Visite</h2>
          <button class="btn btn--secondary" type="button" onClick=${() => onVisit(null)} aria-keyshortcuts="N"><${Icon} name="plus" /> Aggiungi</button>
        </div>
        <h3 class="subhead">Prossime</h3>
        ${upcoming.length ? html`<ul class="item-list">${upcoming.map((v) => html`<${VisitRow} key=${v.id} v=${v} onOpen=${onVisit} />`)}</ul>`
          : html`<p class="card-text">Nessuna visita in programma.</p>`}
        <h3 class="subhead">Passate</h3>
        ${past.length ? html`<ul class="item-list">${past.slice(0, 20).map((v) => html`<${VisitRow} key=${v.id} v=${v} onOpen=${onVisit} />`)}</ul>`
          : html`<p class="card-text">Ancora nessuna visita passata.</p>`}
      <//>
      <${GlassCard} class="spring-in" style="--i:2">
        <div class="card-head">
          <h2 class="card-title">Libretto vaccini</h2>
          <button class="btn btn--secondary" type="button" onClick=${() => onVaccine(null)}><${Icon} name="plus" /> Aggiungi</button>
        </div>
        ${vaccines.length === 0 ? html`<p class="card-text list-empty">Nessun vaccino registrato.</p>` : html`
          <ul class="item-list">
            ${vaccines.map((v) => {
              const st = boosterStatus(v, today);
              return html`<li key=${v.id}>
                <button class="item-row" type="button" onClick=${() => onVaccine(v)}>
                  <span class="item-row__icon" style="--status-color:var(--health);--status-text:var(--health)" aria-hidden="true"><${Icon} name="syringe" /></span>
                  <span class="item-row__main">
                    <span class="item-row__title">${v.name}</span>
                    <span class="item-row__meta">fatto ${formatDueDate(v.date, today)}${v.lot ? ` · lotto ${v.lot}` : ''}${v.boosterDate ? ` · richiamo ${formatDueDate(v.boosterDate, today)}` : ''}</span>
                  </span>
                  ${st && st !== 'ok' && html`<${NeonBadge} status=${st}>${st === 'overdue' ? 'richiamo scaduto' : `richiamo ${daysLabel(daysBetween(today, v.boosterDate))}`}<//>`}
                </button></li>`;
            })}
          </ul>`}
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
  if (!data || (lockEnabled && pinSet === null)) return header;

  return html`
    ${header}
    <div class="health" data-locked=${locked ? 'true' : 'false'}>
      <div class="health__content" inert=${locked} aria-hidden=${locked ? 'true' : undefined}>
        <${HealthContent} data=${data} now=${now} today=${today} onVisit=${setVisit} onVaccine=${setVaccine} />
      </div>
      ${locked && html`<div class="health__lock">${pinSet ? html`<${LockScreen} />` : html`<${PinSetup} onDone=${() => setPinSet(true)} />`}</div>`}
    </div>
    ${!locked && html`
      <${VisitSheet} open=${visit !== undefined} visit=${visit || null} onClose=${() => setVisit(undefined)} />
      <${VaccineSheet} open=${vaccine !== undefined} vaccine=${vaccine || null} today=${today} onClose=${() => setVaccine(undefined)} />`}`;
}
