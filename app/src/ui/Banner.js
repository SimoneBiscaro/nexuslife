import { useRef, useState } from '../../vendor/preact-hooks.mjs';
import { html } from './html.js';
import { Icon } from './icons.js';
import { haptic } from './haptics.js';
import { normalizeStatus } from './status.js';

const DISMISS_PX = 96;
const ICON_FOR = { ok: 'check', warning: 'clock', critical: 'alert', overdue: 'alert', unknown: 'info' };

/**
 * Avviso in evidenza. Swipe orizzontale o ✕ per nasconderlo (onDismiss).
 * @param {{ status?: string, title: any, children?: any, badge?: any, onDismiss?: () => void, dismissLabel?: string }} props
 */
export function Banner({ status = 'unknown', title, children, badge, onDismiss, dismissLabel = 'Nascondi per 24 ore' }) {
  const st = normalizeStatus(status);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const start = useRef(null);

  const dismiss = (dir = 1) => {
    if (leaving) return;
    haptic();
    setLeaving(true);
    setDx(dir * (window.innerWidth || 400));
    setTimeout(() => onDismiss?.(), 280);
  };

  const onPointerDown = (e) => {
    if (!onDismiss || e.target.closest('button, a')) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, active: false };
  };
  const onPointerMove = (e) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const mx = e.clientX - s.x;
    if (!s.active) {
      if (Math.abs(mx) < 8 || Math.abs(mx) < Math.abs(e.clientY - s.y)) return;
      s.active = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
    }
    setDx(mx);
  };
  const onPointerUp = (e) => {
    const s = start.current;
    start.current = null;
    if (!s || !s.active) return;
    setDragging(false);
    const mx = e.clientX - s.x;
    if (Math.abs(mx) > DISMISS_PX) dismiss(Math.sign(mx));
    else setDx(0);
  };

  const cls = `banner${dragging ? ' is-dragging' : ''}${leaving ? ' is-leaving' : ''}`;
  const opacity = dragging ? Math.max(0.3, 1 - Math.abs(dx) / 300) : undefined;

  return html`
    <article class=${cls} data-status=${st}
      style=${`transform:translateX(${dx}px)${opacity !== undefined ? `;opacity:${opacity}` : ''}`}
      onPointerDown=${onPointerDown} onPointerMove=${onPointerMove} onPointerUp=${onPointerUp} onPointerCancel=${onPointerUp}>
      <div class="banner__icon" aria-hidden="true"><${Icon} name=${ICON_FOR[st]} /></div>
      <div class="banner__body">
        <h3 class="banner__title">${title}${badge}</h3>
        ${children && html`<p class="banner__text">${children}</p>`}
      </div>
      ${onDismiss && html`<button class="icon-btn" type="button" onClick=${() => dismiss(1)} aria-label=${dismissLabel}><${Icon} name="close" /></button>`}
    </article>`;
}
