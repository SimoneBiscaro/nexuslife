import { useMemo, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { PageHeader, EmptyState, Skeleton } from '../../ui/Page.js';
import { GlassCard } from '../../ui/GlassCard.js';
import { NeonBadge } from '../../ui/NeonBadge.js';
import { Bouquet, PLANT_COLORS } from '../../ui/Bouquet.js';
import { STATUS_LABEL } from '../../ui/status.js';
import { haptic } from '../../ui/haptics.js';
import { ALL_SECTION_ENTITIES, useEntities } from '../../store/queries.js';
import { DEFAULT_SETTINGS } from '../../store/seed.js';
import { useSignal } from '../../store/state.js';
import { unlocked } from '../../store/lock.js';
import { toDateKey } from '../../domain/dates.js';
import { gardenState, isPending, sortIssues } from '../../domain/garden.js';
import { PlantSheet } from './PlantSheet.js';

/** Righe di ghiaia rastrellata: onde morbide su tutta la larghezza del giardino. */
function RakedGravel() {
  const lines = Array.from({ length: 9 }, (_, i) => {
    const y = 26 + i * 22;
    const a = 5 + (i % 3) * 2;
    return `M-20 ${y}C160 ${y - a} 320 ${y + a} 500 ${y}S840 ${y - a} 1020 ${y}`;
  });
  return html`<svg class="garden__gravel" viewBox="0 0 1000 220" preserveAspectRatio="none" aria-hidden="true" focusable="false">
    ${lines.map((d, i) => html`<path key=${i} d=${d} />`)}
  </svg>`;
}

/** Frecce: spostano il focus tra le voci della legenda (in griglia, su e giù saltano di una riga). */
function onLegendKey(e) {
  const keys = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 'down', ArrowUp: 'up', Home: 'home', End: 'end' };
  const move = keys[e.key];
  if (move === undefined) return;
  const buttons = [...e.currentTarget.querySelectorAll('.garden-legend__item')];
  const i = buttons.indexOf(document.activeElement);
  if (i < 0) return;
  const cols = Math.max(1, getComputedStyle(e.currentTarget).gridTemplateColumns.split(' ').length);
  let next = i;
  if (move === 'home') next = 0;
  else if (move === 'end') next = buttons.length - 1;
  else if (move === 'down') next = i + cols;
  else if (move === 'up') next = i - cols;
  else next = i + move;
  if (next < 0 || next >= buttons.length) return;
  e.preventDefault();
  buttons[next].focus();
}

export function GiardinoView() {
  const now = new Date();
  const today = toDateKey(now);
  const { data } = useEntities(ALL_SECTION_ENTITIES);
  const settings = { ...DEFAULT_SETTINGS, ...(data?.settings?.[0] || {}) };
  const healthOpen = useSignal(unlocked);
  const maskHealth = settings.healthLockEnabled !== false && !healthOpen;
  const garden = useMemo(() => (data ? gardenState(data, { today, now, settings }) : null), [data, today]);

  const [selectedId, setSelectedId] = useState(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(null); // categoria evidenziata nel mazzo
  const selected = garden?.plants.find((p) => p.id === selectedId) || null;
  const show = (id) => { haptic(); setSelectedId(id); setOpen(true); };

  const attention = garden ? sortIssues(garden.plants.flatMap((p) => p.issues.filter(isPending).map((i) => ({ ...i, plantLabel: p.label })))).slice(0, 5) : [];
  const lede = !garden ? 'Le tue cose, a colpo d\'occhio'
    : !garden.hasData ? 'Ogni sezione avrà il suo fiore'
      : garden.healthy === garden.withData ? 'Tutti i fiori stanno bene'
        : `${garden.healthy} ${garden.healthy === 1 ? 'fiore' : 'fiori'} su ${garden.withData} in salute`;

  return html`
    <${PageHeader} eyebrow="Giardino zen" docTitle="Giardino" title="Il tuo giardino" lede=${lede} />

    ${!garden && html`<${Skeleton} cards=${1} rows=${4} label="Caricamento del giardino" />`}

    ${garden && !garden.hasData && html`<${GlassCard} class="spring-in">
      <${EmptyState} art="giardino" accent="var(--mint)" title="Il giardino aspetta i primi semi"
        text="Aggiungi l'auto, l'affitto, la spesa o una visita: ogni sezione aggiungerà un fiore al mazzo. Più le cose sono in ordine, più fiorisce.">
        <a class="btn btn--primary" href="#/oggi">Vai a Oggi</a>
      <//>
    <//>`}

    ${garden?.hasData && html`
      <section class="garden spring-in" aria-label="Giardino zen: un mazzo con un fiore per categoria">
        <${RakedGravel} />
        <div class="garden__bouquet">
          <${Bouquet} plants=${garden.plants} active=${active} onSelect=${show} />
        </div>
        <ul class="garden-legend" onKeyDown=${onLegendKey} aria-label="Legenda: categorie e stato">
          ${garden.plants.map((p) => html`
            <li key=${p.id}>
              <button class="garden-legend__item" type="button" data-stage=${p.stage.id} aria-haspopup="dialog"
                aria-label=${`${p.summary}. Apri i dettagli`} onClick=${() => show(p.id)}
                onMouseEnter=${() => setActive(p.id)} onMouseLeave=${() => setActive(null)}
                onFocus=${() => setActive(p.id)} onBlur=${() => setActive(null)}>
                <span class="garden-legend__swatch" style=${`--flower:${PLANT_COLORS[p.id]}`} aria-hidden="true"></span>
                <span class="garden-legend__name">${p.label}</span>
                <span class="garden-legend__stage"><span class="garden__dot" aria-hidden="true"></span>${p.stage.label}${p.pending > 0 ? ` · ${p.pending}` : ''}</span>
              </button>
            </li>`)}
        </ul>
        <p class="garden__hint">Il colore del fiore indica la categoria. Stelo alto e fiore aperto: tutto in ordine. Stelo piegato, foglie gialle e petali a terra: ci sono cose in sospeso. Bocciolo grigio: ancora nessun dato.</p>
      </section>

      <h2 class="section-title">Da curare</h2>
        <${GlassCard} class="spring-in" style="--i:2">
          ${attention.length === 0
            ? html`<p class="garden-calm">Niente da curare: il giardino è in pace.</p>`
            : html`<ul class="item-list">
                ${attention.map((it) => html`<li key=${it.key}>
                  <button class="item-row" type="button" onClick=${() => show(it.plant)}>
                    <span class="item-row__main">
                      <span class="item-row__title">${maskHealth && it.maskedTitle ? it.maskedTitle : it.title}</span>
                      <span class="item-row__meta">${it.plantLabel}</span>
                    </span>
                    <${NeonBadge} status=${it.status}>${STATUS_LABEL[it.status]}<//>
                  </button>
                </li>`)}
              </ul>`}
        <//>`}

    <${PlantSheet} plant=${selected} open=${open} onClose=${() => setOpen(false)} maskHealth=${maskHealth} />`;
}
