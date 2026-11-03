import { useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { PageHeader, EmptyState } from '../../ui/Page.js';
import { GlassCard } from '../../ui/GlassCard.js';
import { Icon } from '../../ui/icons.js';
import { useEntities } from '../../store/queries.js';
import { toDateKey } from '../../domain/dates.js';
import { suggestGroceries } from '../../domain/suggestions.js';
import { QuickAdd } from './QuickAdd.js';
import { GroceryList } from './GroceryList.js';
import { Suggestions } from './Suggestions.js';
import { ItemSheet } from './ItemSheet.js';
import { CategoryEditor } from './CategoryEditor.js';
import { HistorySheet } from './HistorySheet.js';

const ENTITIES = ['groceryItem', 'groceryCategory', 'groceryPurchase', 'suggestionFeedback'];

export function SpesaView() {
  const today = toDateKey(new Date());
  const { data, error } = useEntities(ENTITIES);
  const [editing, setEditing] = useState(null);
  const [catsOpen, setCatsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const header = html`<${PageHeader} eyebrow="Lista della spesa" title="Spesa"
    actions=${data && html`<div class="header-actions">
      <button class="icon-btn" type="button" onClick=${() => setHistoryOpen(true)} aria-label="Storico acquisti"><${Icon} name="clock" /></button>
      <button class="icon-btn" type="button" onClick=${() => setCatsOpen(true)} aria-label="Modifica categorie"><${Icon} name="list" /></button>
    </div>`} />`;

  if (error) {
    return html`${header}<${EmptyState} icon="alert" title="Archivio non disponibile"
      text="Questo browser non permette di salvare dati (per esempio in navigazione privata)." />`;
  }
  if (!data) return header;

  const items = data.groceryItems.filter((i) => !i.archived);
  const suggestions = suggestGroceries({ purchases: data.groceryPurchases, openItems: items, feedback: data.suggestionFeedback, today });
  const ctx = { categories: data.groceryCategories, purchases: data.groceryPurchases, feedback: data.suggestionFeedback, today };

  return html`
    ${header}
    <div class="spesa">
      <div class="quick-add-wrap"><${QuickAdd} items=${items} categories=${data.groceryCategories} purchases=${data.groceryPurchases} /></div>
      <${Suggestions} list=${suggestions} ctx=${ctx} />
      <${GlassCard} class="spring-in g-card" style="--i:1">
        <${GroceryList} items=${items} categories=${data.groceryCategories} onEdit=${setEditing} />
      <//>
    </div>
    <${ItemSheet} item=${editing} categories=${data.groceryCategories} onClose=${() => setEditing(null)} />
    <${CategoryEditor} open=${catsOpen} onClose=${() => setCatsOpen(false)} categories=${data.groceryCategories}
      items=${data.groceryItems} purchases=${data.groceryPurchases} />
    <${HistorySheet} open=${historyOpen} onClose=${() => setHistoryOpen(false)} purchases=${data.groceryPurchases} today=${today} />`;
}
