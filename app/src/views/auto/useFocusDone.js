import { useEffect, useRef } from '../../../vendor/preact-hooks.mjs';

/**
 * Apertura di uno Sheet "sul Fatto" (tocco su un gauge che chiede "Fatto?"):
 * porta in vista la sezione e mette il focus sul primo campo.
 * @param {boolean} active
 */
export function useFocusDone(active) {
  const ref = useRef(null);
  useEffect(() => {
    if (!active) return undefined;
    // dopo l'animazione d'ingresso dello Sheet e il focus automatico
    const id = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
      el.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
      el.querySelector('input, button')?.focus({ preventScroll: true });
    }, 360);
    return () => clearTimeout(id);
  }, [active]);
  return ref;
}
