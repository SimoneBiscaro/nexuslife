import { html } from '../../ui/html.js';
import { PageHeader, EmptyState } from '../../ui/Page.js';

export function CasaView() {
  return html`
    <${PageHeader} eyebrow="Affitto e utenze" title="Casa" />
    <${EmptyState} icon="casa" accent="var(--mint)"
      title="Casa in ordine"
      text="Rate d'affitto, bollette, manutenzioni periodiche e acquisti per la casa troveranno posto qui." />`;
}
