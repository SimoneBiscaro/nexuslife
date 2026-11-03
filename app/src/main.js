import { render } from '../vendor/preact.mjs';
import { html } from './ui/html.js';
import { useSignal } from './store/state.js';
import { route, startRouter, navigate, SECTIONS } from './router.js';
import { registerServiceWorker } from './pwa.js';
import { Background } from './ui/Background.js';
import { Sidebar } from './ui/Sidebar.js';
import { Topbar } from './ui/Topbar.js';
import { TabBar } from './ui/TabBar.js';
import { ToastHost } from './ui/Toast.js';
import { OggiView } from './views/oggi/OggiView.js';
import { AutoView } from './views/auto/AutoView.js';
import { CasaView } from './views/casa/CasaView.js';
import { SpesaView } from './views/spesa/SpesaView.js';
import { SaluteView } from './views/salute/SaluteView.js';
import { ImpostazioniView } from './views/impostazioni/ImpostazioniView.js';
import { DesignView } from './views/impostazioni/DesignView.js';

const VIEWS = {
  '/oggi': OggiView,
  '/auto': AutoView,
  '/casa': CasaView,
  '/spesa': SpesaView,
  '/salute': SaluteView,
  '/impostazioni': ImpostazioniView,
  '/impostazioni/design': DesignView,
};

function App() {
  const r = useSignal(route);
  const View = VIEWS[r.path] || OggiView;
  return html`
    <div class="app">
      <a class="skip-link" href="#contenuto">Vai al contenuto</a>
      <${Background} />
      <${Sidebar} section=${r.section} path=${r.path} />
      <${Topbar} path=${r.path} />
      <main class="app__main" id="contenuto">
        <div class="page" key=${r.path}><${View} /></div>
      </main>
      <${TabBar} section=${r.section} />
    </div>`;
}

/* ---------- Scorciatoie da tastiera ---------- */
function isTyping(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function onShortcut(e) {
  if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
  if (document.documentElement.classList.contains('has-sheet')) return; // lo Sheet gestisce Esc
  if (isTyping(e.target)) {
    // Esc: un campo di ricerca pieno viene prima svuotato (comportamento nativo), poi si esce dal campo
    if (e.key === 'Escape' && !(e.target.type === 'search' && e.target.value)) e.target.blur();
    return;
  }
  const section = SECTIONS.find((s) => s.key === e.key);
  if (section) {
    e.preventDefault();
    navigate(`/${section.id}`);
    return;
  }
  if (e.key === 'n' || e.key === 'N') {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('nexus:new', { detail: { path: route.value.path } }));
    return;
  }
  if (e.key === '/') {
    const search = document.querySelector('#contenuto [data-search]');
    if (search) {
      e.preventDefault();
      search.focus();
      search.select?.();
    }
  }
}

/* ---------- Bootstrap ---------- */
startRouter();

// Dopo la prima navigazione il titolo della pagina riceve il focus (vedi PageHeader).
route.subscribe(() => {
  document.documentElement.dataset.navigated = '1';
  window.scrollTo({ top: 0, behavior: 'instant' });
});

document.addEventListener('keydown', onShortcut);

const root = document.getElementById('app');
root.textContent = '';
render(html`<${App} />`, root);
// ToastHost resta fuori da #app: così non diventa inerte quando uno Sheet è aperto.
const toastRoot = document.createElement('div');
document.body.appendChild(toastRoot);
render(html`<${ToastHost} />`, toastRoot);

registerServiceWorker();
