import { useEffect, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { Sheet } from '../../ui/Sheet.js';
import { Icon } from '../../ui/icons.js';
import { TextField } from '../../ui/forms.js';
import { showToast } from '../../ui/Toast.js';
import { applyRestore, inspectBackup } from '../../store/backup.js';
import { summarize } from '../../backup/restore.js';

const fmt = new Intl.DateTimeFormat('it-IT', { dateStyle: 'long', timeStyle: 'short' });
const SECTIONS = ['Auto', 'Casa', 'Spesa', 'Salute', 'Impostazioni'];

/**
 * Ripristino: lettura del file (con passphrase se .nxbak), anteprima, Unisci o Sostituisci tutto.
 */
export function RestoreSheet({ file, onClose }) {
  const open = Boolean(file);
  const [state, setState] = useState({ step: 'reading' });
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState(0);

  const read = async (pass) => {
    setState({ step: 'reading' });
    try {
      const backup = await inspectBackup(file, pass);
      setState({ step: 'preview', backup });
    } catch (err) {
      if (err.code === 'passphrase') setState({ step: 'passphrase' });
      else setState({ step: pass ? 'passphrase' : 'error', error: err.message });
    }
  };

  useEffect(() => { if (file) { setPassphrase(''); setConfirm(0); read(); } }, [file]);

  const restore = async (mode) => {
    if (mode === 'replace' && confirm < 2) { setConfirm(confirm + 1); return; }
    setState((s) => ({ ...s, step: 'writing' }));
    try {
      const n = await applyRestore(state.backup, mode);
      onClose();
      showToast({ message: mode === 'replace' ? `Dati sostituiti dal pacchetto (${n} modifiche)` : `Pacchetto unito (${n} record aggiornati)` });
    } catch (err) {
      console.error(err);
      setState((s) => ({ ...s, step: 'error', error: 'Ripristino non riuscito: i dati attuali non sono stati toccati' }));
    }
  };

  const b = state.backup;
  const counts = b ? summarize(b.records) : {};
  return html`
    <${Sheet} open=${open} onClose=${onClose} title="Ripristina da pacchetto">
      ${state.step === 'reading' && html`<p class="card-text">Lettura e verifica del pacchetto…</p>`}
      ${state.step === 'writing' && html`<p class="card-text">Ripristino in corso…</p>`}
      ${state.step === 'error' && html`<p class="form-error" role="alert">${state.error}</p>`}
      ${state.step === 'passphrase' && html`
        <form class="form-grid" onSubmit=${(e) => { e.preventDefault(); read(passphrase); }}>
          <p class="card-text span-2">Questo pacchetto (.nxbak) è protetto: inserisci la passphrase usata per crearlo.</p>
          <${TextField} label="Passphrase" type="password" value=${passphrase} onValue=${setPassphrase} error=${state.error}
            autocomplete="off" class="span-2" data-autofocus />
          <div class="form-actions span-2"><button class="btn btn--primary" type="submit" disabled=${!passphrase}><${Icon} name="lock" /> Apri</button></div>
        </form>`}
      ${state.step === 'preview' && html`
        <div class="detail-hero">
          <p class="detail-hero__date">${b.meta.exportedAt ? fmt.format(new Date(b.meta.exportedAt)) : 'Data sconosciuta'}</p>
          <span class=${`tag${b.verified ? ' tag--ok' : ''}`}>${b.verified ? 'Integrità verificata' : 'Solo nexuslife.json'}</span>
        </div>
        <dl class="detail-list">
          ${SECTIONS.filter((s) => counts[s]).map((s) => html`<div key=${s}><dt>${s}</dt><dd>${counts[s]} record</dd></div>`)}
          <div><dt>Versione app</dt><dd>${b.meta.appVersion || '—'}</dd></div>
          ${b.meta.excludeHealth && html`<div class="detail-list__wide"><dt>Nota</dt><dd>Pacchetto senza dati di Salute</dd></div>`}
        </dl>
        <div class="restore-modes">
          <div class="restore-mode">
            <h3 class="renew__title">Unisci</h3>
            <p class="card-text">Aggiunge ciò che manca e, per ogni elemento presente in entrambi, tiene la versione più recente.</p>
            <button class="btn btn--primary" type="button" onClick=${() => restore('merge')}><${Icon} name="layers" /> Unisci</button>
          </div>
          <div class="restore-mode restore-mode--danger">
            <h3 class="renew__title">Sostituisci tutto</h3>
            <p class="card-text">I dati attuali vengono eliminati e restano solo quelli del pacchetto.</p>
            <button class=${`btn ${confirm ? 'btn--danger' : 'btn--secondary'}`} type="button" onClick=${() => restore('replace')}>
              <${Icon} name="trash" /> ${['Sostituisci tutto', 'Sei sicuro? Tocca ancora', 'Conferma definitiva'][confirm]}
            </button>
          </div>
        </div>`}
    <//>`;
}
