import { html } from '../../ui/html.js';
import { GlassCard } from '../../ui/GlassCard.js';
import { LineChart } from '../../ui/LineChart.js';
import { Icon } from '../../ui/icons.js';
import { formatDecimal, formatInt, formatLongDate } from '../../ui/format.js';
import { addDays } from '../../domain/dates.js';

/** Chilometraggio: valore attuale, grafico delle letture, stima km/giorno e data del tagliando. */
export function MileageCard({ overview, readings, onUpdate, today }) {
  const { kmPerDay, service, currentKm } = overview;
  const yearAgo = addDays(today, -365);
  const points = readings.filter((r) => r.date >= yearAgo).map((r) => ({ date: r.date, value: Number(r.km) }));

  return html`
    <${GlassCard} class="mileage spring-in" style="--i:5">
      <div class="card-head">
        <div>
          <h2 class="card-title">Chilometraggio</h2>
          <p class="mileage__value"><span class="num">${formatInt(currentKm)}</span> <span class="mileage__unit">km</span></p>
        </div>
        <button class="btn btn--primary" type="button" onClick=${onUpdate}><${Icon} name="road" /> Aggiorna km</button>
      </div>
      <${LineChart} points=${points} label="Letture degli ultimi 12 mesi" unit="km" />
      <dl class="detail-list">
        <div><dt>Media</dt><dd>${formatDecimal(kmPerDay.kmPerDay)} km/giorno
          ${kmPerDay.generic && html` <span class="tag">stima generica</span>`}</dd></div>
        <div><dt>Tagliando previsto</dt><dd>${service.estimatedKmDate ? formatLongDate(service.estimatedKmDate) : '—'}</dd></div>
      </dl>
    <//>`;
}
