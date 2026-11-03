import { html } from './html.js';
import { Icon } from './icons.js';
import { SECTIONS } from '../router.js';
import { haptic } from './haptics.js';

/** Barra inferiore in vetro, 5 voci fisse (< 900 px). */
export function TabBar({ section }) {
  return html`
    <nav class="tabbar" aria-label="Sezioni">
      ${SECTIONS.map((s) => html`
        <a class="tabbar__item" href=${`#/${s.id}`} key=${s.id} onClick=${() => haptic()}
          aria-current=${section === s.id ? 'page' : undefined}>
          <${Icon} name=${s.id} class="nav-icon" />
          <span>${s.label}</span>
        </a>`)}
    </nav>`;
}
