/* NexusLife — service worker. Incrementare CACHE_VERSION a ogni modifica dell'app shell. */
const CACHE_VERSION = 'v2';
const SHELL_CACHE = `nexuslife-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = 'nexuslife-runtime';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './config.js',
  './icons/icon.svg',
  './icons/icon-maskable.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './fonts/nunito-latin-400-normal.woff2',
  './fonts/nunito-latin-600-normal.woff2',
  './fonts/nunito-latin-700-normal.woff2',
  './fonts/nunito-latin-800-normal.woff2',
  './fonts/newsreader-latin-500-normal.woff2',
  './fonts/newsreader-latin-600-normal.woff2',
  './fonts/newsreader-latin-400-italic.woff2',
  './vendor/preact.mjs',
  './vendor/preact-hooks.mjs',
  './vendor/htm.mjs',
  './styles/tokens.css',
  './styles/base.css',
  './styles/components.css',
  './src/main.js',
  './src/router.js',
  './src/pwa.js',
  './src/version.js',
  './src/store/state.js',
  './src/ui/html.js',
  './src/ui/icons.js',
  './src/ui/haptics.js',
  './src/ui/status.js',
  './src/ui/GlassCard.js',
  './src/ui/HudGauge.js',
  './src/ui/NeonBadge.js',
  './src/ui/Sheet.js',
  './src/ui/Toast.js',
  './src/ui/Banner.js',
  './src/ui/TabBar.js',
  './src/ui/Sidebar.js',
  './src/ui/Topbar.js',
  './src/ui/Background.js',
  './src/ui/Page.js',
  './src/ui/ConnectionStatus.js',
  './src/views/oggi/OggiView.js',
  './src/views/auto/AutoView.js',
  './src/views/casa/CasaView.js',
  './src/views/spesa/SpesaView.js',
  './src/views/salute/SaluteView.js',
  './src/views/impostazioni/ImpostazioniView.js',
  './src/views/impostazioni/DesignView.js',
];

const scopeUrl = (p) => new URL(p, self.registration.scope).href;
let shellUrls = null;
const isShell = (url) => {
  if (!shellUrls) shellUrls = new Set(SHELL.map(scopeUrl));
  return shellUrls.has(url);
};

self.addEventListener('install', (event) => {
  // cache: 'reload' evita di salvare copie vecchie dalla cache HTTP del browser
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(SHELL.map((p) => new Request(p, { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((k) => k.startsWith('nexuslife-shell-') && k !== SHELL_CACHE)
      .map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  const type = event.data?.type;
  if (type === 'SKIP_WAITING') self.skipWaiting();
  if (type === 'GET_VERSION') event.ports[0]?.postMessage({ version: CACHE_VERSION });
});

async function cacheFirst(request, key) {
  const cache = await caches.open(SHELL_CACHE);
  const hit = await cache.match(key, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(key, res.clone());
  return res;
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Supabase e terze parti: nessuna cache

  if (request.mode === 'navigate') {
    event.respondWith(cacheFirst(request, scopeUrl('./index.html')));
    return;
  }
  const clean = `${url.origin}${url.pathname}`;
  if (isShell(clean)) {
    event.respondWith(cacheFirst(request, clean));
    return;
  }
  event.respondWith(networkFirst(request));
});
