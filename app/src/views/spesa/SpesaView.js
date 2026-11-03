import { html } from '../../ui/html.js';
import { PageHeader, EmptyState } from '../../ui/Page.js';

export function SpesaView() {
  return html`
    <${PageHeader} eyebrow="Lista della spesa" title="Spesa" />
    <${EmptyState} icon="spesa" accent="var(--amber)"
      title="La lista è vuota"
      text="Aggiungi ciò che manca: col tempo NexusLife impara le tue abitudini e ti suggerisce cosa sta per finire." />`;
}
