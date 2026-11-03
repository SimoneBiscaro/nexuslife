import { html } from '../../ui/html.js';
import { PageHeader, EmptyState } from '../../ui/Page.js';

export function SaluteView() {
  return html`
    <${PageHeader} eyebrow="Visite e vaccini" title="Salute" />
    <${EmptyState} icon="salute" accent="var(--health)"
      title="Nessuna visita in programma"
      text="Visite mediche, promemoria dei controlli e libretto vaccinale troveranno posto in quest'area riservata." />`;
}
