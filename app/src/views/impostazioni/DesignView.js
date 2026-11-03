import { useEffect, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { PageHeader } from '../../ui/Page.js';
import { GlassCard } from '../../ui/GlassCard.js';
import { HudGauge } from '../../ui/HudGauge.js';
import { NeonBadge } from '../../ui/NeonBadge.js';
import { Banner } from '../../ui/Banner.js';
import { Sheet } from '../../ui/Sheet.js';
import { showToast } from '../../ui/Toast.js';
import { Icon } from '../../ui/icons.js';
import { STATUSES, STATUS_LABEL } from '../../ui/status.js';

/*
 * Catalogo visivo interno (#/impostazioni/design): mostra i componenti nei 5 stati.
 * I valori qui sotto sono campioni del catalogo, non dati dell'utente.
 */

const PALETTE = [
  ['obsidian', '#0A0A0C'], ['obsidian-elevated', '#121216'], ['obsidian-raised', '#1A1B20'],
  ['titanium-deep', '#2A2C31'], ['titanium', '#5C5F66'], ['titanium-light', '#8E9196'], ['titanium-specular', '#C7CAD1'],
  ['champagne', '#D9BF8C'], ['champagne-light', '#F2E3C2'], ['champagne-deep', '#9C8355'],
  ['electric-blue', '#3D8BFF'], ['electric-blue-glow', '#6FA8FF'],
  ['mint', '#3DDC97'], ['amber', '#FFB020'], ['alarm-red', '#FF453A'], ['health', '#FF6B8B'],
  ['text-primary', '#F5F5F7'], ['text-secondary', '#A1A1A6'], ['text-tertiary', '#6E6E73'],
];

const GAUGE_SAMPLES = [
  { status: 'ok', label: 'Bollo', value: 214, unit: 'giorni', ratio: 0.59, sublabel: 'scade il 4/6' },
  { status: 'warning', label: 'Assicurazione', value: 21, unit: 'giorni', ratio: 0.18, sublabel: 'scade il 24/11' },
  { status: 'critical', label: 'Revisione', value: 5, unit: 'giorni', ratio: 0.03, sublabel: 'scade l’8/11' },
  { status: 'overdue', label: 'Tagliando', value: -3, unit: 'giorni', ratio: 0, sublabel: 'scaduto il 31/10' },
  { status: 'unknown', label: 'Bollo', value: null, unit: 'giorni', ratio: 0, sublabel: 'data mancante' },
];

const SECTIONS = [
  { id: 'colori', title: 'Colori', keys: 'colori palette token' },
  { id: 'tipografia', title: 'Tipografia', keys: 'tipografia font serif numeri' },
  { id: 'glass', title: 'GlassCard', keys: 'glasscard vetro card riflesso' },
  { id: 'gauge', title: 'HudGauge', keys: 'hudgauge gauge anello hud scadenze' },
  { id: 'badge', title: 'NeonBadge', keys: 'neonbadge badge pill urgente' },
  { id: 'banner', title: 'Banner', keys: 'banner avviso swipe' },
  { id: 'toast', title: 'Toast', keys: 'toast annulla notifica' },
  { id: 'sheet', title: 'Sheet', keys: 'sheet pannello dialog modale' },
  { id: 'pulsanti', title: 'Pulsanti', keys: 'pulsanti bottoni button' },
  { id: 'motion', title: 'Motion', keys: 'motion molla animazione' },
];

export function DesignView() {
  const [query, setQuery] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [hidden, setHidden] = useState(() => new Set());
  const [motionOn, setMotionOn] = useState(false);

  useEffect(() => {
    const onNew = () => setSheetOpen(true);
    window.addEventListener('nexus:new', onNew);
    return () => window.removeEventListener('nexus:new', onNew);
  }, []);

  const q = query.trim().toLowerCase();
  const visible = (id) => {
    if (!q) return true;
    const s = SECTIONS.find((x) => x.id === id);
    return `${s.title} ${s.keys}`.toLowerCase().includes(q);
  };
  const anyVisible = SECTIONS.some((s) => visible(s.id));

  const onToast = () => {
    showToast({
      message: 'Latte spuntato',
      onAction: () => showToast({ message: 'Azione annullata', status: 'unknown', duration: 2500 }),
    });
  };

  const section = (id, body) => visible(id) && html`
    <section class="catalog-section" id=${`design-${id}`} aria-labelledby=${`design-${id}-t`}>
      <h2 class="section-title" id=${`design-${id}-t`}>${SECTIONS.find((s) => s.id === id).title}</h2>
      ${body}
    </section>`;

  return html`
    <a class="btn btn--ghost catalog-back" href="#/impostazioni"><${Icon} name="back" /> Impostazioni</a>
    <${PageHeader} eyebrow="Catalogo interno" title="Design system"
      lede="Tutti i componenti di NexusLife nei cinque stati: ok, warning, critical, overdue, unknown." />

    <div class="catalog-toolbar">
      <label class="field">
        <${Icon} name="search" />
        <span class="sr-only">Filtra componenti</span>
        <input type="search" data-search placeholder="Filtra componenti" value=${query}
          onInput=${(e) => setQuery(e.currentTarget.value)}
          onSearch=${(e) => setQuery(e.currentTarget.value)} autocomplete="off" />
        <kbd aria-hidden="true">/</kbd>
      </label>
      <button class="btn btn--primary" type="button" onClick=${() => setSheetOpen(true)} aria-keyshortcuts="N">
        <${Icon} name="plus" /> Apri sheet
      </button>
    </div>

    ${!anyVisible && html`<p class="card-text">Nessun componente corrisponde a “${query}”.</p>`}

    ${section('colori', html`
      <div class="swatches">
        ${PALETTE.map(([name, hex]) => html`
          <div class="swatch" key=${name}>
            <div class="swatch__chip" style=${`background:var(--${name})`}></div>
            <span class="swatch__name">--${name}</span>
            <span class="swatch__hex">${hex}</span>
          </div>`)}
      </div>`)}

    ${section('tipografia', html`
      <${GlassCard}>
        <div class="type-sample">
          <p class="page-title" style="font-size:var(--fs-2xl)">Titolo di sezione · New York / Newsreader</p>
          <p class="type-sample__serif"><em>Corsivo serif per le citazioni</em></p>
          <p>Testo UI in SF Pro Rounded / Nunito, leggibile e morbido.</p>
          <p class="card-text">Testo secondario per dettagli e didascalie.</p>
          <p class="type-sample__num">1.234,56 € · 12.480 km · 07/11/2026</p>
        </div>
      <//>`)}

    ${section('glass', html`
      <div class="grid-cards">
        <${GlassCard}>
          <h3 class="card-title">Card statica</h3>
          <p class="card-text">Vetro con riflesso radente: passa il puntatore per vederlo scorrere.</p>
        <//>
        <${GlassCard} interactive onClick=${() => showToast({ message: 'Card premuta' })}>
          <h3 class="card-title">Card interattiva</h3>
          <p class="card-text">Pressione con molla (scale .97) e feedback aptico dove disponibile.</p>
        <//>
        <${GlassCard} variant="compact">
          <h3 class="card-title">Card compatta</h3>
          <p class="card-text">Raggio 18 px, padding 16 px.</p>
        <//>
      </div>`)}

    ${section('gauge', html`
      <${GlassCard}>
        <div class="gauge-row">
          ${GAUGE_SAMPLES.map((g) => html`<${HudGauge} key=${g.status} ...${g} />`)}
          <${HudGauge} label="Tagliando" value="2.400" unit="km" ratio=${0.16} status="warning" sublabel="mancano al tagliando" />
        </div>
      <//>`)}

    ${section('badge', html`
      <${GlassCard}>
        <div class="badge-row">
          ${STATUSES.map((s) => html`<${NeonBadge} key=${s} status=${s}>${STATUS_LABEL[s]}<//>`)}
        </div>
        <div class="badge-row" style="margin-top:var(--space-4)">
          <${NeonBadge} status="warning">Urgente<//>
          <${NeonBadge} status="critical" pulse>Urgente da 3 giorni<//>
        </div>
      <//>`)}

    ${section('banner', html`
      <div class="stack">
        ${STATUSES.filter((s) => !hidden.has(s)).map((s) => html`
          <${Banner} key=${s} status=${s} title=${`Banner ${STATUS_LABEL[s].toLowerCase()}`}
            badge=${html`<${NeonBadge} status=${s}>${s}<//>`}
            onDismiss=${() => setHidden((prev) => new Set(prev).add(s))}>
            Trascina di lato o tocca ✕ per nasconderlo.
          <//>`)}
        ${hidden.size > 0 && html`
          <div><button class="btn btn--secondary" type="button" onClick=${() => setHidden(new Set())}>
            <${Icon} name="refresh" /> Ripristina banner
          </button></div>`}
      </div>`)}

    ${section('toast', html`
      <${GlassCard}>
        <p class="card-text" style="margin:0 0 var(--space-4)">Toast con “Annulla” per 5 secondi e barra del tempo residuo.</p>
        <button class="btn btn--secondary" type="button" onClick=${onToast}><${Icon} name="check" /> Mostra toast</button>
      <//>`)}

    ${section('sheet', html`
      <${GlassCard}>
        <p class="card-text" style="margin:0 0 var(--space-4)">Dal basso su mobile, centrato su desktop. Si apre anche con <kbd>N</kbd> e si chiude con <kbd>Esc</kbd>.</p>
        <button class="btn btn--secondary" type="button" onClick=${() => setSheetOpen(true)}><${Icon} name="layers" /> Apri sheet</button>
      <//>`)}

    ${section('pulsanti', html`
      <${GlassCard}>
        <div class="badge-row">
          <button class="btn btn--primary" type="button">Primario</button>
          <button class="btn btn--secondary" type="button">Secondario</button>
          <button class="btn btn--ghost" type="button">Testuale</button>
          <button class="btn btn--danger" type="button">Elimina</button>
          <button class="icon-btn" type="button" aria-label="Aggiungi"><${Icon} name="plus" /></button>
        </div>
      <//>`)}

    ${section('motion', html`
      <${GlassCard}>
        <p class="card-text" style="margin:0 0 var(--space-4)">Molla cubic-bezier(.34, 1.56, .64, 1) in 450 ms. Disattivata con “riduci movimento”.</p>
        <div class="badge-row">
          <div class=${`demo-motion${motionOn ? ' is-on' : ''}`} aria-hidden="true"></div>
          <button class="btn btn--secondary" type="button" onClick=${() => setMotionOn((v) => !v)} aria-pressed=${motionOn}>
            <${Icon} name="sparkle" /> Prova la molla
          </button>
        </div>
      <//>`)}

    <${Sheet} open=${sheetOpen} onClose=${() => setSheetOpen(false)} title="Sheet di esempio"
      footer=${html`
        <button class="btn btn--secondary" type="button" onClick=${() => setSheetOpen(false)}>Chiudi</button>
        <button class="btn btn--primary" type="button" onClick=${() => { setSheetOpen(false); showToast({ message: 'Confermato' }); }}>Conferma</button>`}>
      <p class="card-text" style="margin:0 0 var(--space-4)">Su iPhone trascina la maniglia verso il basso per chiudere.</p>
      <label class="field">
        <span class="sr-only">Campo di prova</span>
        <input type="text" placeholder="Campo di prova" data-autofocus />
      </label>
    <//>`;
}
