import { html } from './html.js';

/** Sfondo ossidiana con gradienti radiali che si spostano lentamente (40 s). */
export function Background() {
  return html`<div class="aurora" aria-hidden="true">
    <div class="aurora__blob aurora__blob--champagne"></div>
    <div class="aurora__blob aurora__blob--blue"></div>
    <div class="aurora__blob aurora__blob--deep"></div>
    <div class="aurora__grain"></div>
  </div>`;
}
