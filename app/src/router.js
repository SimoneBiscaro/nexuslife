import { signal } from './store/state.js';

/** Le 5 sezioni fisse (D3), nell'ordine delle scorciatoie 1–5. */
export const SECTIONS = [
  { id: 'oggi', label: 'Oggi', key: '1', accent: 'var(--champagne)' },
  { id: 'auto', label: 'Auto', key: '2', accent: 'var(--electric-blue-glow)' },
  { id: 'casa', label: 'Casa', key: '3', accent: 'var(--mint)' },
  { id: 'spesa', label: 'Spesa', key: '4', accent: 'var(--amber)' },
  { id: 'salute', label: 'Salute', key: '5', accent: 'var(--health)' },
];

/** Pagine fuori dalla TabBar raggiungibili con una scorciatoia (Sidebar e tastiera). */
export const EXTRA_PAGES = [{ id: 'giardino', label: 'Giardino', key: 'g' }];

const VALID = new Set(['oggi', 'auto', 'casa', 'spesa', 'salute', 'giardino', 'impostazioni', 'impostazioni/design']);
export const DEFAULT_PATH = '/oggi';

/**
 * Converte l'hash in rotta. Restituisce null se la rotta non esiste.
 * @param {string} hash es. "#/impostazioni/design"
 */
export function parseHash(hash) {
  const clean = String(hash || '').replace(/^#\/?/, '').replace(/[?].*$/, '').replace(/\/+$/, '');
  if (!VALID.has(clean)) return null;
  const [section, ...rest] = clean.split('/');
  return { path: `/${clean}`, section, sub: rest.join('/') };
}

export const route = signal(parseHash(typeof location !== 'undefined' ? location.hash : '') || parseHash(`#${DEFAULT_PATH}`));

export function navigate(path) {
  const target = `#${path}`;
  if (location.hash !== target) location.hash = target;
}

function sync() {
  const next = parseHash(location.hash);
  if (!next) {
    history.replaceState(null, '', `${location.pathname}${location.search}#${DEFAULT_PATH}`);
    route.value = parseHash(`#${DEFAULT_PATH}`);
    return;
  }
  if (next.path !== route.value?.path) route.value = next;
}

export function startRouter() {
  window.addEventListener('hashchange', sync);
  sync();
}
