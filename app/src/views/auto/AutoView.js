import { html } from '../../ui/html.js';
import { PageHeader, EmptyState } from '../../ui/Page.js';

export function AutoView() {
  return html`
    <${PageHeader} eyebrow="Garage" title="Auto" />
    <${EmptyState} icon="auto" accent="var(--electric-blue-glow)"
      title="Nessun veicolo"
      text="Il gemello digitale della tua auto terrà d'occhio bollo, assicurazione, revisione e tagliando, con il conto alla rovescia di giorni e chilometri." />`;
}
