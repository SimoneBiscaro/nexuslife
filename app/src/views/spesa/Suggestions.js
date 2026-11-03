import { useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { Icon } from '../../ui/icons.js';
import { NeonBadge } from '../../ui/NeonBadge.js';
import { showToast } from '../../ui/Toast.js';
import { haptic } from '../../ui/haptics.js';
import { getRepo } from '../../store/repo.js';
import { suggestCategory } from '../../domain/groceries.js';
import { snoozeUntil } from '../../domain/suggestions.js';
import { saveFeedback } from './feedback.js';

const CONFIDENCE = { alta: 'ok', media: 'warning', bassa: 'unknown' };

function SuggestionCard({ s, ctx, index }) {
  const [menu, setMenu] = useState(false);

  async function add() {
    const repo = await getRepo();
    const exists = ctx.categories.some((c) => !c.deleted && c.id === s.categoryId);
    const categoryId = exists ? s.categoryId : suggestCategory(s.normName, { categories: ctx.categories, history: ctx.purchases });
    const item = await repo.create('groceryItem', {
      name: s.name, normName: s.normName, quantity: 1, urgency: 'normale', categoryId,
      addedAt: new Date().toISOString(), checkedAt: null, archived: false,
    });
    haptic();
    showToast({ message: `Aggiunto: ${s.name}`, onAction: () => repo.softDelete('groceryItem', item.id) });
  }

  async function snooze() {
    await saveFeedback(ctx.feedback, s.normName, { snoozeUntil: snoozeUntil(ctx.today) });
    showToast({ message: `${s.name}: te lo ricordo tra 3 giorni`, duration: 2500 });
  }

  async function mute() {
    const rec = await saveFeedback(ctx.feedback, s.normName, { muted: true });
    const repo = await getRepo();
    showToast({ message: `${s.name} non verrà più suggerito`, onAction: () => repo.update('suggestionFeedback', rec.id, { muted: false }) });
  }

  return html`
    <li class="sugg spring-in glass" style=${`--i:${index}`}>
      ${menu
        ? html`<div class="sugg__menu">
            <button class="btn btn--secondary" type="button" onClick=${snooze}><${Icon} name="clock" /> Tra 3 giorni</button>
            <button class="btn btn--secondary" type="button" onClick=${mute}><${Icon} name="mute" /> Non suggerire più</button>
            <button class="btn btn--ghost" type="button" onClick=${() => setMenu(false)}>Chiudi</button>
          </div>`
        : html`
          <div class="sugg__top">
            <span class="sugg__name">${s.name}</span>
            <button class="icon-btn sugg__more" type="button" onClick=${() => setMenu(true)} aria-label=${`Opzioni per ${s.name}`}>
              <${Icon} name="more" /></button>
          </div>
          <p class="sugg__cycle">di solito ogni ${Math.round(s.cycle)} giorni</p>
          <div class="sugg__bottom">
            <${NeonBadge} status=${CONFIDENCE[s.confidence]} label=${`Fiducia ${s.confidence}`}>fiducia ${s.confidence}<//>
            <button class="btn btn--primary sugg__add" type="button" onClick=${add} aria-label=${`Aggiungi ${s.name} alla lista`}>
              <${Icon} name="plus" /></button>
          </div>`}
    </li>`;
}

/** "Suggeriti per te": card orizzontali. */
export function Suggestions({ list, ctx }) {
  if (!list.length) return null;
  return html`
    <section class="suggestions" aria-labelledby="sugg-title">
      <h2 class="section-title" id="sugg-title">Suggeriti per te</h2>
      <ul class="sugg-row">
        ${list.map((s, i) => html`<${SuggestionCard} key=${s.normName} s=${s} ctx=${ctx} index=${i} />`)}
      </ul>
    </section>`;
}
