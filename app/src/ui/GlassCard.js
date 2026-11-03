import { h } from '../../vendor/preact.mjs';
import { useRef } from '../../vendor/preact-hooks.mjs';
import { canHover, haptic } from './haptics.js';

/**
 * Card in vetro con riflesso radente che segue il puntatore (solo con hover:hover).
 * @param {{ as?: string, interactive?: boolean, variant?: 'compact'|'flush', class?: string, onClick?: Function, children?: any }} props
 * Con `interactive` la card reagisce alla pressione (scale .97 + haptic). Se ha `onClick`
 * e nessun `as`, viene resa come <button> per essere raggiungibile da tastiera.
 */
export function GlassCard({ as, interactive = false, variant, class: cls = '', onClick, children, ...rest }) {
  const ref = useRef(null);
  const tag = as || (interactive && onClick ? 'button' : 'div');

  const onPointerMove = (e) => {
    if (!canHover || e.pointerType === 'touch' || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    // proiezione sulla diagonale: il riflesso scorre in obliquo come una luce radente
    const t = ((e.clientX - r.left) / r.width) * 0.7 + ((e.clientY - r.top) / r.height) * 0.3;
    ref.current.style.setProperty('--glare-x', `${(t * 100).toFixed(1)}%`);
  };

  const handleClick = (e) => {
    if (interactive) haptic();
    onClick?.(e);
  };

  const classes = ['glass-card', interactive && 'is-interactive', variant && `glass-card--${variant}`, cls]
    .filter(Boolean).join(' ');

  return h(tag, {
    ref,
    class: classes,
    type: tag === 'button' ? 'button' : undefined,
    onPointerMove,
    onClick: onClick || interactive ? handleClick : undefined,
    ...rest,
  }, children);
}
