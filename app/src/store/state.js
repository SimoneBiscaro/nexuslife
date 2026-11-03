import { useEffect, useReducer, useRef, useState } from '../../vendor/preact-hooks.mjs';

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

/* ---------- Cambi ai dati ---------- */

/** Un contatore per entità: cresce a ogni scrittura, così le viste sanno quando rileggere. */
const entityVersions = new Map();

export function entityVersion(entity) {
  if (!entityVersions.has(entity)) entityVersions.set(entity, signal(0));
  return entityVersions.get(entity);
}

// Le altre schede aperte sulla stessa app ricevono la notifica e rileggono anch'esse.
const channel = typeof window !== 'undefined' && typeof BroadcastChannel === 'function'
  ? new BroadcastChannel('nexuslife-data')
  : null;
if (channel) {
  channel.onmessage = (e) => {
    if (Array.isArray(e.data?.entities)) notifyChange(e.data.entities, { broadcast: false });
  };
}

/** Segnala che i record delle entità indicate sono cambiati. */
export function notifyChange(entities, { broadcast = true } = {}) {
  const list = [...new Set(entities)];
  for (const e of list) entityVersion(e).value += 1;
  if (broadcast && channel && list.length) channel.postMessage({ entities: list });
}

/** Hook: valore che cambia quando cambia una qualsiasi delle entità. */
export function useEntityVersion(entities) {
  const versions = entities.map((e) => useSignal(entityVersion(e)));
  return versions.join('.');
}

/**
 * Hook: esegue `load` (async) e lo ripete quando cambiano le entità o le dipendenze.
 * @returns {{ data: any, error: any, loading: boolean }}
 */
export function useQuery(load, entities, deps = []) {
  const version = useEntityVersion(entities);
  const [state, setState] = useState({ data: undefined, error: null, loading: true });
  const run = useRef(0);
  useEffect(() => {
    const id = ++run.current;
    Promise.resolve()
      .then(load)
      .then((data) => { if (id === run.current) setState({ data, error: null, loading: false }); })
      .catch((error) => { if (id === run.current) setState((s) => ({ ...s, error, loading: false })); });
  }, [version, ...deps]);
  return state;
}
