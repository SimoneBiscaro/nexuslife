/* NexusLife — service worker. Incrementare CACHE_VERSION a ogni modifica dell'app shell. */
const CACHE_VERSION = 'v8';
const SHELL_CACHE = `nexuslife-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = 'nexuslife-runtime';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './config.js',
  './icons/icon.svg',
  './icons/icon-maskable.svg',
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
  './src/store/db.js',
  './src/store/repo.js',
  './src/store/seed.js',
  './src/store/settings.js',
  './src/store/queries.js',
  './src/store/home.js',
  './src/store/lock.js',
  './src/store/calendar.js',
  './src/store/backup.js',
  './src/store/demo.js',
  './src/store/cloud.js',
  './src/sync/crypto.js',
  './src/sync/auth.js',
  './src/sync/api.js',
  './src/sync/sync.js',
  './src/backup/zip.js',
  './src/backup/csv.js',
  './src/backup/report.js',
  './src/backup/package.js',
  './src/backup/restore.js',
  './src/domain/dates.js',
  './src/domain/deadlines.js',
  './src/domain/service.js',
  './src/domain/mileage.js',
  './src/domain/rent.js',
  './src/domain/groceries.js',
  './src/domain/suggestions.js',
  './src/domain/reminders.js',
  './src/domain/dedupe.js',
  './src/domain/overview.js',
  './src/domain/home.js',
  './src/domain/health.js',
  './src/domain/ics.js',
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
  './src/ui/Illustration.js',
  './src/ui/ConnectionStatus.js',
  './src/ui/format.js',
  './src/ui/forms.js',
  './src/ui/LineChart.js',
  './src/ui/DigitalTwin.js',
  './src/ui/BarChart.js',
  './src/ui/palette.js',
  './src/ui/download.js',
  './src/ui/CalendarButton.js',
  './src/ui/PinPad.js',
  './src/ui/incremental.js',
  './src/ui/memo.js',
  './src/views/oggi/OggiView.js',
  './src/views/auto/AutoView.js',
  './src/views/auto/gauges.js',
  './src/views/auto/VehicleWizard.js',
  './src/views/auto/DeadlineSheet.js',
  './src/views/auto/ServiceSheet.js',
  './src/views/auto/KmSheet.js',
  './src/views/auto/MileageCard.js',
  './src/views/auto/ExpensesCard.js',
  './src/views/auto/ExpenseSheet.js',
  './src/views/casa/CasaView.js',
  './src/views/casa/RentCard.js',
  './src/views/casa/ContractSheet.js',
  './src/views/casa/PaySheet.js',
  './src/views/casa/BillsCard.js',
  './src/views/casa/BillSheet.js',
  './src/views/casa/MaintenanceCard.js',
  './src/views/casa/MaintenanceSheet.js',
  './src/views/casa/HomePurchasesCard.js',
  './src/views/casa/HomePurchaseSheet.js',
  './src/views/spesa/SpesaView.js',
  './src/views/spesa/QuickAdd.js',
  './src/views/spesa/GroceryList.js',
  './src/views/spesa/Suggestions.js',
  './src/views/spesa/feedback.js',
  './src/views/spesa/ItemSheet.js',
  './src/views/spesa/CategoryEditor.js',
  './src/views/spesa/HistorySheet.js',
  './src/views/salute/SaluteView.js',
  './src/views/salute/LockScreen.js',
  './src/views/salute/VisitSheet.js',
  './src/views/salute/VaccineSheet.js',
  './src/views/impostazioni/ImpostazioniView.js',
  './src/views/impostazioni/DesignView.js',
  './src/views/impostazioni/RestoreSheet.js',
  './src/views/impostazioni/PinCheckSheet.js',
  './src/views/impostazioni/AccountCard.js',
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

async function optionalAsset(request) {
  try {
    const res = await networkFirst(request);
    return res.ok ? res : new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 204 });
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
  // Foto opzionale del gemello digitale (D8): se manca rispondiamo 204, senza errori in console.
  if (url.pathname.endsWith('/assets/tcross.jpg')) {
    event.respondWith(optionalAsset(request));
    return;
  }
  const clean = `${url.origin}${url.pathname}`;
  if (isShell(clean)) {
    event.respondWith(cacheFirst(request, clean));
    return;
  }
  event.respondWith(networkFirst(request));
});
