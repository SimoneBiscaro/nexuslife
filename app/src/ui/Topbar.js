import { html } from './html.js';
import { Icon, BrandMark } from './icons.js';
import { ConnectionDot } from './ConnectionStatus.js';

/** Barra superiore compatta (< 900 px): marchio, stato rete, Impostazioni. */
export function Topbar({ path }) {
  return html`
    <header class="topbar">
      <a class="topbar__brand" href="#/oggi" aria-label="NexusLife, vai a Oggi">
        <${BrandMark} />
        <span aria-hidden="true">NexusLife</span>
      </a>
      <${ConnectionDot} />
      <a class="icon-btn" href="#/impostazioni" aria-label="Impostazioni"
        aria-current=${path.startsWith('/impostazioni') ? 'page' : undefined}>
        <${Icon} name="impostazioni" />
      </a>
    </header>`;
}
