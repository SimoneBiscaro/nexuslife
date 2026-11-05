import { html } from '../../ui/html.js';
import { Sheet } from '../../ui/Sheet.js';
import { NeonBadge } from '../../ui/NeonBadge.js';
import { Icon } from '../../ui/icons.js';
import { Bouquet } from '../../ui/Bouquet.js';
import { STATUS_LABEL } from '../../ui/status.js';
import { isPending } from '../../domain/garden.js';

const SECTION_NAME = { auto: 'Auto', casa: 'Casa', spesa: 'Spesa', salute: 'Salute', impostazioni: 'Impostazioni' };

const STAGE_TEXT = {
  fiorita: 'Tutto in ordine: il fiore è in piena fioritura.',
  sana: 'Sta bene, ma c\'è qualcosa da tenere d\'occhio.',
  assetata: 'Ha bisogno di attenzione: alcune cose aspettano da un po\'.',
  appassita: 'Sta soffrendo: ci sono cose urgenti o scadute.',
  secca: 'Si è seccata: ci sono cose scadute da tempo.',
  germoglio: 'Ancora nessun dato: il bocciolo si aprirà quando aggiungi qualcosa in questa sezione.',
};

function IssueRow({ issue, masked, onGo }) {
  const title = masked && issue.maskedTitle ? issue.maskedTitle : issue.title;
  return html`
    <li>
      <a class="item-row" href=${issue.href} onClick=${onGo}>
        <span class="item-row__main"><span class="item-row__title">${title}</span></span>
        <${NeonBadge} status=${issue.status}>${STATUS_LABEL[issue.status]}<//>
      </a>
    </li>`;
}

/** Dettaglio di una pianta: stadio, salute e cause con i link per risolverle. */
export function PlantSheet({ plant, open, onClose, maskHealth }) {
  if (!plant) return null;
  const pending = plant.issues.filter(isPending);
  const missing = plant.issues.filter((i) => i.status === 'unknown');
  const masked = maskHealth && plant.id === 'salute';
  const section = SECTION_NAME[plant.section] || plant.label;
  const pct = plant.score === null ? null : Math.round(plant.score * 100);

  const footer = html`
    <button class="btn btn--secondary" type="button" onClick=${onClose}>Chiudi</button>
    <a class="btn btn--primary" href=${plant.href} onClick=${onClose}>Vai a ${section}</a>`;

  return html`
    <${Sheet} open=${open} onClose=${onClose} title=${plant.label} footer=${footer}>
      <div class="plant-detail">
        <div class="plant-detail__art"><${Bouquet} plants=${[plant]} size="sm" still /></div>
        <div class="plant-detail__text">
          <p class="plant-detail__stage" data-stage=${plant.stage.id}>${plant.stage.label}</p>
          <p class="plant-detail__lede">${STAGE_TEXT[plant.stage.id]}</p>
          ${pct !== null && html`<div class="plant-meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${pct}
            aria-label=${`Salute della pianta ${pct} su 100`} style=${`--pct:${pct}%`} data-stage=${plant.stage.id}>
            <span class="plant-meter__fill"></span>
            <span class="plant-meter__value">${pct}%</span>
          </div>`}
        </div>
      </div>

      ${pending.length > 0 && html`
        <h3 class="sheet-subtitle">${pending.length === 1 ? 'Cosa la fa soffrire' : `Cosa la fa soffrire (${pending.length})`}</h3>
        <ul class="item-list">${pending.map((i) => html`<${IssueRow} key=${i.key} issue=${i} masked=${masked} onGo=${onClose} />`)}</ul>`}
      ${missing.length > 0 && html`
        <h3 class="sheet-subtitle">Da completare</h3>
        <ul class="item-list">${missing.map((i) => html`<${IssueRow} key=${i.key} issue=${i} masked=${masked} onGo=${onClose} />`)}</ul>`}
      ${plant.hasData && pending.length === 0 && html`<p class="plant-detail__ok"><${Icon} name="check" /> Niente in sospeso in ${plant.label}.</p>`}
    <//>`;
}
