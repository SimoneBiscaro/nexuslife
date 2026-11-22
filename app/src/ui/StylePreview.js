import { html } from './html.js';
import { HudGauge } from './HudGauge.js';
import { NeonBadge } from './NeonBadge.js';

/**
 * Miniatura reale di uno stile/tema: una card "Oggi" e un HudGauge disegnati con i componenti veri
 * dentro un contenitore con data-style/data-theme (i token si applicano solo lì dentro).
 * Decorativa: il nome dello stile è nel pulsante che la contiene.
 */
export function StylePreview({ style, theme }) {
  return html`
    <div class="style-preview" data-style=${style} data-theme=${theme} aria-hidden="true">
      <div class="style-preview__page">
        <p class="style-preview__eyebrow">Oggi</p>
        <p class="style-preview__title">Buongiorno</p>
        <div class="glass-card glass-card--compact style-preview__card">
          <div class="style-preview__row">
            <span class="style-preview__line">Assicurazione</span>
            <${NeonBadge} status="warning">tra 5 giorni<//>
          </div>
          <div class="style-preview__row">
            <span class="style-preview__line">Tagliando</span>
            <${NeonBadge} status="booked">prenotato<//>
          </div>
        </div>
        <div class="style-preview__gauges">
          <${HudGauge} label="Bollo" value="18" unit="" ratio=${0.62} status="ok" size=${52} />
          <${HudGauge} label="Revisione" value="6" unit="" ratio=${0.4} status="booked" icon="calendar" size=${52} />
          <${HudGauge} label="Gomme" value="3" unit="" ratio=${0.05} status="critical" size=${52} />
        </div>
      </div>
    </div>`;
}
