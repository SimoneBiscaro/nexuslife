import { signal } from './store/state.js';
import { showToast } from './ui/Toast.js';

/** Versione della cache attiva, letta dal service worker. */
export const cacheVersion = signal(null);
/** Registrazione del service worker, se attiva. */
export const swRegistration = signal(null);

let reloadRequested = false;

function promptUpdate(worker) {
  showToast({
    message: 'Nuova versione disponibile',
    actionLabel: 'Ricarica',
    duration: Infinity,
    status: 'warning',
    onAction: () => {
      reloadRequested = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
    },
  });
}

function askVersion() {
  const ctrl = navigator.serviceWorker.controller;
  if (!ctrl) return;
  const ch = new MessageChannel();
  ch.port1.onmessage = (e) => { cacheVersion.value = e.data?.version ?? null; };
  ctrl.postMessage({ type: 'GET_VERSION' }, [ch.port2]);
}

/** Registra sw.js e gestisce l'avviso "Nuova versione disponibile – Ricarica". */
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    askVersion();
    if (reloadRequested) location.reload();
  });

  try {
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    swRegistration.value = reg;
    askVersion();

    if (reg.waiting && navigator.serviceWorker.controller) promptUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) promptUpdate(worker);
      });
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  } catch (err) {
    console.warn('Service worker non registrato:', err);
  }
}

/** Controllo manuale degli aggiornamenti (Impostazioni). */
export async function checkForUpdate() {
  const reg = swRegistration.value;
  if (!reg) return 'unsupported';
  await reg.update();
  return reg.installing || reg.waiting ? 'found' : 'none';
}

/** true se l'app è aperta come PWA installata. */
export function isStandalone() {
  return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}
