import { useEffect, useReducer } from '../../vendor/preact-hooks.mjs';

/**
 * Segnale minimale: valore osservabile con sottoscrizioni.
 * @template T
 * @param {T} initial
 */
export function signal(initial) {
  let value = initial;
  const subscribers = new Set();
  return {
    get value() { return value; },
    set value(next) {
      if (Object.is(next, value)) return;
      value = next;
      for (const fn of [...subscribers]) fn(value);
    },
    /** @param {(v: T) => void} fn */
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
  };
}

/** Hook: ri-renderizza il componente quando il segnale cambia. */
export function useSignal(sig) {
  const [, force] = useReducer((n) => n + 1, 0);
  useEffect(() => {
    const seen = sig.value;
    const off = sig.subscribe(() => force());
    if (!Object.is(seen, sig.value)) force();
    return off;
  }, [sig]);
  return sig.value;
}

/** Stato di rete del dispositivo. */
export const online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { online.value = true; });
  window.addEventListener('offline', () => { online.value = false; });
}
