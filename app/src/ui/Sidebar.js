import { html } from './html.js';
import { Icon, BrandMark } from './icons.js';
import { SECTIONS } from '../router.js';
import { GlassCard } from './GlassCard.js';
import { SyncDot } from './ConnectionStatus.js';

/** Sidebar in vetro (≥ 900 px) con scorciatoie da tastiera. */
export function Sidebar({ section, path }) {
  return html`
    <aside class="sidebar">
      <${GlassCard} class="sidebar__panel">
        <div class="sidebar__brand">
          <${BrandMark} />
          <div>
            <div class="sidebar__name">NexusLife</div>
            <${SyncDot} withLabel=${true} />
          </div>
        </div>
        <nav class="sidebar__nav" aria-label="Sezioni">
          ${SECTIONS.map((s) => html`
            <a class="sidebar__item" href=${`#/${s.id}`} key=${s.id}
              aria-current=${section === s.id ? 'page' : undefined} aria-keyshortcuts=${s.key}>
              <${Icon} name=${s.id} class="nav-icon" />
              <span>${s.label}</span>
              <kbd aria-hidden="true">${s.key}</kbd>
            </a>`)}
        </nav>
        <div class="sidebar__spacer"></div>
        <div class="sidebar__keys" aria-label="Scorciatoie da tastiera">
          <div><kbd>N</kbd> Nuovo elemento</div>
          <div><kbd>/</kbd> Cerca</div>
          <div><kbd>Esc</kbd> Chiudi pannello</div>
        </div>
        <a class="sidebar__item" href="#/impostazioni" aria-current=${path.startsWith('/impostazioni') ? 'page' : undefined}>
          <${Icon} name="impostazioni" class="nav-icon" />
          <span>Impostazioni</span>
        </a>
      <//>
    </aside>`;
}
