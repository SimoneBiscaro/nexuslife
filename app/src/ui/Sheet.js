import { createPortal } from '../../vendor/preact.mjs';
import { useEffect, useId, useRef, useState } from '../../vendor/preact-hooks.mjs';
import { html } from './html.js';
import { Icon } from './icons.js';

const EXIT_MS = 320;
const DRAG_CLOSE_PX = 110;

let openCount = 0;
function lockApp(lock) {
  openCount = Math.max(0, openCount + (lock ? 1 : -1));
  const active = openCount > 0;
  document.documentElement.classList.toggle('has-sheet', active);
  const app = document.getElementById('app');
  if (app) app.inert = active;
}

/**
 * Pannello modale: dal basso su mobile, dialog centrato su desktop (≥ 900 px).
 * Esc, tocco sullo sfondo o trascinamento della maniglia verso il basso chiudono.
 * @param {{ open: boolean, onClose: () => void, title: string, children?: any, footer?: any }} props
 */
export function Sheet({ open, onClose, title, children, footer }) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const panelRef = useRef(null);
  const returnFocus = useRef(null);
  const drag = useRef(null);
  const titleId = `sheet-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (open) {
      returnFocus.current = document.activeElement;
      setMounted(true);
      setDragY(0);
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setVisible(true));
      });
      return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
    }
    setVisible(false);
    const t = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!mounted) return undefined;
    lockApp(true);
    const focusable = panelRef.current?.querySelector('[data-autofocus], input, textarea, select, button:not(.sheet__close), [href]');
    (focusable || panelRef.current)?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current?.(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      lockApp(false);
      const el = returnFocus.current;
      if (el && typeof el.focus === 'function' && document.contains(el)) el.focus({ preventScroll: true });
    };
  }, [mounted]);

  if (!mounted) return null;

  const onGrabDown = (e) => {
    if (matchMedia('(min-width: 900px)').matches) return;
    drag.current = { y: e.clientY, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onGrabMove = (e) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    setDragY(Math.max(0, e.clientY - drag.current.y));
  };
  const onGrabUp = (e) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    const dy = e.clientY - drag.current.y;
    drag.current = null;
    setDragging(false);
    if (dy > DRAG_CLOSE_PX) onClose();
    else setDragY(0);
  };

  const cls = `sheet${visible && open ? ' is-open' : ''}${dragging ? ' is-dragging' : ''}`;

  return createPortal(html`
    <div class=${cls} style=${`--drag-y:${dragY}px`}>
      <div class="sheet__backdrop" onClick=${onClose} aria-hidden="true"></div>
      <div class="sheet__panel" role="dialog" aria-modal="true" aria-labelledby=${titleId} tabindex="-1" ref=${panelRef}>
        <div class="sheet__grab" onPointerDown=${onGrabDown} onPointerMove=${onGrabMove} onPointerUp=${onGrabUp} onPointerCancel=${onGrabUp} aria-hidden="true"></div>
        <div class="sheet__head">
          <h2 class="sheet__title" id=${titleId}>${title}</h2>
          <button class="icon-btn sheet__close" type="button" onClick=${onClose} aria-label="Chiudi"><${Icon} name="close" /></button>
        </div>
        <div class="sheet__body">${children}</div>
        ${footer && html`<div class="sheet__foot">${footer}</div>`}
      </div>
    </div>`, document.body);
}
