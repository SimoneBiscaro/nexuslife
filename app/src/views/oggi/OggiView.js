import { html } from '../../ui/html.js';
import { PageHeader, EmptyState } from '../../ui/Page.js';

const dateFmt = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

export function OggiView() {
  return html`
    <${PageHeader} eyebrow=${dateFmt.format(new Date())} title="Oggi" />
    <${EmptyState} icon="oggi" accent="var(--champagne)"
      title="Tutto tranquillo"
      text="Qui compariranno le scadenze dell'auto, le rate, le bollette e le visite in arrivo nei prossimi 30 giorni, ordinate per urgenza." />`;
}
