import { html } from './html.js';
import { Icon, BrandMark } from './icons.js';
import { SyncDot } from './ConnectionStatus.js';

/** Barra superiore compatta (< 900 px): marchio, stato della sync, Impostazioni. */
export function Topbar({ path }) {
  return html`
    <header class="topbar">
      <a class="topbar__brand" href="#/oggi" aria-label="NexusLife, vai a Oggi">
        <${BrandMark} />
        <span aria-hidden="true">NexusLife</span>
      </a>
      <${SyncDot} />
      <a class="icon-btn" href="#/todo" aria-label="To Do" aria-current=${path === '/todo' ? 'page' : undefined}>
        <${Icon} name="todo" />
      </a>
      <a class="icon-btn" href="#/giardino" aria-label="Giardino zen" aria-current=${path === '/giardino' ? 'page' : undefined}>
        <${Icon} name="giardino" />
      </a>
      <a class="icon-btn" href="#/impostazioni" aria-label="Impostazioni"
        aria-current=${path.startsWith('/impostazioni') ? 'page' : undefined}>
        <${Icon} name="impostazioni" />
      </a>
    </header>`;
}
