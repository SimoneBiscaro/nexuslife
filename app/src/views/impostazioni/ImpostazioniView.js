import { useRef, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { PageHeader } from '../../ui/Page.js';
import { GlassCard } from '../../ui/GlassCard.js';
import { Icon } from '../../ui/icons.js';
import { ConnectionDot } from '../../ui/ConnectionStatus.js';
import { showToast } from '../../ui/Toast.js';
import { useSignal, online } from '../../store/state.js';
import { navigate } from '../../router.js';
import { APP_VERSION } from '../../version.js';
import { cacheVersion, checkForUpdate, isStandalone } from '../../pwa.js';

const TAPS_TO_UNLOCK = 5;

export function ImpostazioniView() {
  const cache = useSignal(cacheVersion);
  const isOnline = useSignal(online);
  const [checking, setChecking] = useState(false);
  const taps = useRef({ n: 0, t: 0 });

  // Link nascosto al catalogo design: 5 tocchi rapidi sulla versione.
  const onVersionTap = () => {
    const now = Date.now();
    taps.current.n = now - taps.current.t < 800 ? taps.current.n + 1 : 1;
    taps.current.t = now;
    if (taps.current.n >= TAPS_TO_UNLOCK) {
      taps.current.n = 0;
      navigate('/impostazioni/design');
    }
  };

  const onCheck = async () => {
    setChecking(true);
    try {
      const res = await checkForUpdate();
      if (res === 'none') showToast({ message: 'Hai già l’ultima versione' });
      if (res === 'unsupported') showToast({ message: 'Aggiornamenti offline non attivi in questo browser', status: 'unknown' });
    } catch {
      showToast({ message: 'Impossibile controllare: sei offline?', status: 'warning' });
    } finally {
      setChecking(false);
    }
  };

  return html`
    <${PageHeader} eyebrow="Preferenze" title="Impostazioni" />
    <div class="stack" style="max-width:640px">
      <${GlassCard}>
        <h2 class="card-title">App</h2>
        <div class="rows">
          <button class="row" type="button" onClick=${onVersionTap} aria-label=${`Versione ${APP_VERSION}`}>
            <span class="row__label">Versione</span>
            <span class="row__value">${APP_VERSION}</span>
          </button>
          <div class="row">
            <span class="row__label">Copia offline</span>
            <span class="row__value">${cache ? `Attiva · ${cache}` : 'Non attiva'}</span>
          </div>
          <div class="row">
            <span class="row__label">Modalità</span>
            <span class="row__value">${isStandalone() ? 'App installata' : 'Browser'}</span>
          </div>
          <div class="row">
            <span class="row__label">Connessione</span>
            <span class="row__value"><${ConnectionDot} /> ${isOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>
        <div style="margin-top:var(--space-4)">
          <button class="btn btn--secondary" type="button" onClick=${onCheck} disabled=${checking}>
            <${Icon} name="refresh" /> ${checking ? 'Controllo…' : 'Cerca aggiornamenti'}
          </button>
        </div>
      <//>
      <${GlassCard}>
        <h2 class="card-title">Scorciatoie da tastiera</h2>
        <div class="rows">
          <div class="row"><span class="row__label">Sezioni</span><span class="row__value"><kbd>1</kbd>–<kbd>5</kbd></span></div>
          <div class="row"><span class="row__label">Nuovo elemento</span><span class="row__value"><kbd>N</kbd></span></div>
          <div class="row"><span class="row__label">Cerca</span><span class="row__value"><kbd>/</kbd></span></div>
          <div class="row"><span class="row__label">Chiudi pannello</span><span class="row__value"><kbd>Esc</kbd></span></div>
        </div>
      <//>
    </div>`;
}
