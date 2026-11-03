import { useEffect, useRef, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { PageHeader } from '../../ui/Page.js';
import { GlassCard } from '../../ui/GlassCard.js';
import { Icon } from '../../ui/icons.js';
import { Segmented, SelectField, TextField } from '../../ui/forms.js';
import { ConnectionDot } from '../../ui/ConnectionStatus.js';
import { showToast } from '../../ui/Toast.js';
import { useSignal, online } from '../../store/state.js';
import { useEntities } from '../../store/queries.js';
import { updateSettings } from '../../store/settings.js';
import { DEFAULT_SETTINGS } from '../../store/seed.js';
import { exportAllReminders } from '../../store/calendar.js';
import { clearAllLocalData, downloadBackup } from '../../store/backup.js';
import { hasDemoData, loadDemoData, removeDemoData } from '../../store/demo.js';
import {
  clearPin, hasPin, hasWebAuthn, lockNow, registerWebAuthn, removeWebAuthn, webAuthnAvailable,
} from '../../store/lock.js';
import { navigate } from '../../router.js';
import { APP_VERSION } from '../../version.js';
import { cacheVersion, checkForUpdate, isStandalone } from '../../pwa.js';
import { BACKUP_THRESHOLDS } from '../../domain/overview.js';
import { CategoryEditor } from '../spesa/CategoryEditor.js';
import { RestoreSheet } from './RestoreSheet.js';
import { PinCheckSheet } from './PinCheckSheet.js';
import { AccountCard } from './AccountCard.js';

const TAPS_TO_UNLOCK = 5;
const ENTITIES = ['settings', 'groceryCategory', 'groceryItem', 'groceryPurchase'];
const dateTime = new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' });
const kb = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);

function Section({ icon, title, index, children }) {
  return html`<${GlassCard} class="settings-card spring-in" style=${`--i:${index}`}>
    <h2 class="card-title settings-card__title"><${Icon} name=${icon} /> ${title}</h2>
    ${children}
  <//>`;
}

function ProfileCard({ settings }) {
  const [name, setName] = useState(settings.profileName || '');
  useEffect(() => setName(settings.profileName || ''), [settings.profileName]);
  const save = () => {
    const value = name.trim();
    if (value && value !== settings.profileName) updateSettings({ profileName: value });
    else setName(settings.profileName || '');
  };
  return html`<${Section} icon="user" title="Profilo" index=${0}>
    <${TextField} label="Come ti chiami" value=${name} onValue=${setName} onBlur=${save}
      onKeyDown=${(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} hint="Usato nel saluto di Oggi" autocomplete="given-name" />
  <//>`;
}

function HealthLockCard({ settings }) {
  const enabled = settings.healthLockEnabled !== false;
  const [pin, setPin] = useState(null);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bio, setBio] = useState(false);
  const [check, setCheck] = useState(null); // { title, action }

  const refresh = () => Promise.all([hasPin(), webAuthnAvailable(), hasWebAuthn()]).then(([p, a, b]) => { setPin(p); setBioAvailable(a); setBio(b); });
  useEffect(() => { refresh(); }, []);

  const setEnabled = (value) => {
    if (value === 'on') { updateSettings({ healthLockEnabled: true }); return; }
    if (!pin) { updateSettings({ healthLockEnabled: false }); return; }
    setCheck({
      title: 'Disattiva il blocco',
      action: async () => { await clearPin(); await updateSettings({ healthLockEnabled: false }); showToast({ message: 'Blocco Salute disattivato' }); },
    });
  };

  const resetPin = () => setCheck({
    title: 'Reimposta il PIN',
    action: async () => { await clearPin(); lockNow(); showToast({ message: 'Sceglierai il nuovo PIN aprendo Salute' }); },
  });

  const toggleBio = async () => {
    try {
      if (bio) { await removeWebAuthn(); showToast({ message: 'Face ID / Touch ID rimosso' }); }
      else { await registerWebAuthn(); showToast({ message: 'Face ID / Touch ID attivo per Salute' }); }
    } catch (err) {
      if (err?.name !== 'NotAllowedError') console.warn(err);
      showToast({ message: 'Operazione annullata', status: 'unknown', duration: 2500 });
    }
    refresh();
  };

  return html`<${Section} icon="lock" title="Blocco Salute" index=${1}>
    <${Segmented} label="Chiedi il PIN aprendo Salute" value=${enabled ? 'on' : 'off'} onValue=${setEnabled}
      options=${[{ value: 'on', label: 'Attivo' }, { value: 'off', label: 'Disattivo' }]} />
    <p class="form-hint settings-note">Dopo 5 minuti di inattività Salute si blocca e nel multitasking il contenuto viene oscurato. Il PIN resta solo su questo dispositivo.</p>
    ${enabled && html`<div class="settings-actions">
      ${pin && html`<button class="btn btn--secondary" type="button" onClick=${resetPin}><${Icon} name="refresh" /> Reimposta PIN</button>`}
      ${pin && bioAvailable && html`<button class="btn btn--secondary" type="button" onClick=${toggleBio}>
        <${Icon} name="faceid" /> ${bio ? 'Rimuovi Face ID / Touch ID' : 'Usa Face ID / Touch ID'}</button>`}
      ${!pin && html`<p class="form-hint">Il PIN ti verrà chiesto al primo accesso a Salute.</p>`}
    </div>`}
    <${PinCheckSheet} open=${Boolean(check)} title=${check?.title || ''} onClose=${() => setCheck(null)}
      onConfirmed=${async () => { await check.action(); setCheck(null); refresh(); }} />
  <//>`;
}

function RemindersCard({ settings }) {
  const [busy, setBusy] = useState(false);
  const hours = Array.from({ length: 17 }, (_, i) => i + 6).map((h) => ({ value: String(h), label: `${String(h).padStart(2, '0')}:00` }));
  const exportAll = async () => {
    setBusy(true);
    try {
      const n = await exportAllReminders();
      showToast({ message: n ? `${n} scadenze esportate: apri il file con Calendario` : 'Nessuna scadenza futura da esportare', status: n ? 'ok' : 'unknown' });
    } catch (err) {
      console.error(err);
      showToast({ message: 'Esportazione non riuscita', status: 'critical' });
    } finally { setBusy(false); }
  };
  return html`<${Section} icon="calendar" title="Promemoria" index=${2}>
    <${SelectField} label="Ora dei promemoria" value=${String(settings.reminderHour ?? 9)} options=${hours}
      onValue=${(v) => updateSettings({ reminderHour: Number(v) })} hint="Ora di Roma per gli avvisi delle scadenze" />
    <p class="form-hint settings-note">Niente notifiche push: esporti un file .ics e Calendario ti avvisa con i preavvisi (auto 30/7/1 giorni, affitto e bollette 3 giorni, visite 24 e 2 ore…). Reimportandolo gli eventi si aggiornano senza doppioni.</p>
    <div class="settings-actions"><button class="btn btn--primary" type="button" onClick=${exportAll} disabled=${busy}>
      <${Icon} name="download" /> Esporta tutti i promemoria</button></div>
  <//>`;
}

function BackupCard({ settings, onRestore }) {
  const [protect, setProtect] = useState(false);
  const [excludeHealth, setExcludeHealth] = useState(false);
  const [pass, setPass] = useState({ a: '', b: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const download = async () => {
    if (protect && pass.a.length < 8) { setError('Almeno 8 caratteri'); return; }
    if (protect && pass.a !== pass.b) { setError('Le due passphrase non coincidono'); return; }
    setError('');
    setBusy(true);
    try {
      const res = await downloadBackup({ excludeHealth, passphrase: protect ? pass.a : '' });
      if (res.result !== 'cancelled') showToast({ message: `${res.filename} pronto (${res.records} record, ${kb(res.size)})` });
      setPass({ a: '', b: '' });
    } catch (err) {
      console.error(err);
      showToast({ message: 'Creazione del pacchetto non riuscita', status: 'critical' });
    } finally { setBusy(false); }
  };

  const history = settings.backupHistory || [];
  return html`<${Section} icon="database" title="Backup" index=${4}>
    <p class="card-text">Un pacchetto .zip con tutti i dati (JSON per il ripristino, CSV per Excel, riepilogo stampabile).
      ${settings.lastBackupAt ? html` Ultimo: <strong>${dateTime.format(new Date(settings.lastBackupAt))}</strong>.` : ' Non hai ancora creato pacchetti.'}</p>
    <div class="checks">
      <label class="check"><input type="checkbox" checked=${protect} onChange=${(e) => setProtect(e.currentTarget.checked)} />
        <span><strong>Proteggi con passphrase</strong><small>Scarica un file .nxbak cifrato: consigliato per iCloud Drive, email e chiavette.</small></span></label>
      <label class="check"><input type="checkbox" checked=${excludeHealth} onChange=${(e) => setExcludeHealth(e.currentTarget.checked)} />
        <span><strong>Escludi Salute</strong><small>Per un pacchetto da condividere, es. col coinquilino per l'affitto.</small></span></label>
    </div>
    ${protect && html`<div class="form-grid settings-pass">
      <${TextField} label="Passphrase" type="password" value=${pass.a} onValue=${(v) => setPass((p) => ({ ...p, a: v }))} autocomplete="new-password" error=${error} />
      <${TextField} label="Ripeti passphrase" type="password" value=${pass.b} onValue=${(v) => setPass((p) => ({ ...p, b: v }))} autocomplete="new-password"
        hint="Senza passphrase il pacchetto non si può aprire: conservala bene" />
    </div>`}
    <div class="settings-actions">
      <button class="btn btn--primary" type="button" onClick=${download} disabled=${busy}><${Icon} name="download" /> ${busy ? 'Preparazione…' : 'Scarica pacchetto di oggi'}</button>
      <button class="btn btn--secondary" type="button" onClick=${() => fileRef.current?.click()}><${Icon} name="upload" /> Ripristina da pacchetto</button>
      <input ref=${fileRef} type="file" hidden accept=".zip,.nxbak,.json,application/zip,application/json,application/octet-stream"
        onChange=${(e) => { const f = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (f) onRestore(f); }} />
    </div>
    <${Segmented} label="Ricordami di fare un backup dopo" value=${String(settings.backupReminderDays ?? 30)}
      onValue=${(v) => updateSettings({ backupReminderDays: Number(v) })}
      options=${BACKUP_THRESHOLDS.map((d) => ({ value: String(d), label: `${d} giorni` }))} />
    ${history.length > 0 && html`
      <h3 class="subhead">Ultimi pacchetti</h3>
      <ul class="item-list">
        ${history.map((h) => html`<li key=${h.at} class="backup-row">
          <span class="item-row__main">
            <span class="item-row__title">${h.filename}</span>
            <span class="item-row__meta">${dateTime.format(new Date(h.at))} · ${h.records} record · ${kb(h.size)}${h.encrypted ? ' · cifrato' : ''}${h.excludeHealth ? ' · senza Salute' : ''}</span>
          </span></li>`)}
      </ul>`}
  <//>`;
}

function DataCard() {
  const [demo, setDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(0);
  useEffect(() => { hasDemoData().then(setDemo).catch(() => {}); }, []);

  const toggleDemo = async () => {
    setBusy(true);
    try {
      if (demo) { const n = await removeDemoData(); showToast({ message: `Dati demo rimossi (${n})` }); setDemo(false); }
      else { const n = await loadDemoData(); showToast({ message: `Dati demo caricati (${n}): esplora Oggi, Auto, Casa, Spesa e Salute` }); setDemo(true); }
    } finally { setBusy(false); }
  };

  const wipe = async () => {
    if (confirm < 2) { setConfirm(confirm + 1); return; }
    await clearAllLocalData();
  };

  return html`<${Section} icon="layers" title="Dati" index=${5}>
    <div class="settings-row">
      <div><strong>Dati demo</strong><p class="form-hint">Esempi per provare l'app, separati dai tuoi e rimovibili in un tocco.</p></div>
      <button class="btn btn--secondary" type="button" onClick=${toggleDemo} disabled=${busy}>${demo ? 'Rimuovi dati demo' : 'Carica dati demo'}</button>
    </div>
    <div class="settings-row">
      <div><strong>Cancella tutti i dati locali</strong><p class="form-hint">Svuota questo dispositivo: veicoli, spesa, casa, salute, PIN e preferenze. Fai prima un backup.</p></div>
      <button class=${`btn ${confirm ? 'btn--danger' : 'btn--secondary'}`} type="button" onClick=${wipe}>
        <${Icon} name="trash" /> ${['Cancella tutto', 'Sei sicuro? Tocca ancora', 'Conferma: cancella ora'][confirm]}
      </button>
    </div>
    ${confirm > 0 && html`<button class="btn btn--ghost" type="button" onClick=${() => setConfirm(0)}>Annulla</button>`}
  <//>`;
}

function AppCard() {
  const cache = useSignal(cacheVersion);
  const isOnline = useSignal(online);
  const [checking, setChecking] = useState(false);
  const taps = useRef({ n: 0, t: 0 });

  // Link nascosto al catalogo design: 5 tocchi rapidi sulla versione.
  const onVersionTap = () => {
    const now = Date.now();
    taps.current.n = now - taps.current.t < 800 ? taps.current.n + 1 : 1;
    taps.current.t = now;
    if (taps.current.n >= TAPS_TO_UNLOCK) { taps.current.n = 0; navigate('/impostazioni/design'); }
  };

  const onCheck = async () => {
    setChecking(true);
    try {
      const res = await checkForUpdate();
      if (res === 'none') showToast({ message: 'Hai già l’ultima versione' });
      if (res === 'unsupported') showToast({ message: 'Aggiornamenti offline non attivi in questo browser', status: 'unknown' });
    } catch {
      showToast({ message: 'Impossibile controllare: sei offline?', status: 'warning' });
    } finally { setChecking(false); }
  };

  return html`<${Section} icon="sparkle" title="App" index=${6}>
    <div class="rows">
      <button class="row" type="button" onClick=${onVersionTap} aria-label=${`Versione ${APP_VERSION}`}>
        <span class="row__label">Versione</span><span class="row__value">${APP_VERSION}</span>
      </button>
      <div class="row"><span class="row__label">Copia offline</span><span class="row__value">${cache ? `Attiva · ${cache}` : 'Non attiva'}</span></div>
      <div class="row"><span class="row__label">Modalità</span><span class="row__value">${isStandalone() ? 'App installata' : 'Browser'}</span></div>
      <div class="row"><span class="row__label">Connessione</span><span class="row__value"><${ConnectionDot} /> ${isOnline ? 'Online' : 'Offline'}</span></div>
      <div class="row"><span class="row__label">Scorciatoie</span><span class="row__value"><kbd>1</kbd>–<kbd>5</kbd> <kbd>N</kbd> <kbd>/</kbd> <kbd>Esc</kbd></span></div>
    </div>
    <div class="settings-actions">
      <button class="btn btn--secondary" type="button" onClick=${onCheck} disabled=${checking}>
        <${Icon} name="refresh" /> ${checking ? 'Controllo…' : 'Cerca aggiornamenti'}</button>
    </div>
  <//>`;
}

export function ImpostazioniView() {
  const { data } = useEntities(ENTITIES);
  const [catsOpen, setCatsOpen] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const settings = { ...DEFAULT_SETTINGS, ...(data?.settings?.[0] || {}) };

  return html`
    <${PageHeader} eyebrow="Preferenze" title="Impostazioni" />
    ${data && html`<div class="settings-grid">
      <${ProfileCard} settings=${settings} />
      <${AccountCard} index=${1} />
      <${HealthLockCard} settings=${settings} />
      <${RemindersCard} settings=${settings} />
      <${Section} icon="spesa" title="Spesa" index=${3}>
        <p class="card-text">${data.groceryCategories.length} categorie: nomi, icone, colori e ordine della lista.</p>
        <div class="settings-actions"><button class="btn btn--secondary" type="button" onClick=${() => setCatsOpen(true)}><${Icon} name="list" /> Categorie spesa</button></div>
      <//>
      <${BackupCard} settings=${settings} onRestore=${setRestoreFile} />
      <${DataCard} />
      <${AppCard} />
    </div>
    <${CategoryEditor} open=${catsOpen} onClose=${() => setCatsOpen(false)} categories=${data.groceryCategories}
      items=${data.groceryItems} purchases=${data.groceryPurchases} />
    <${RestoreSheet} file=${restoreFile} onClose=${() => setRestoreFile(null)} />`}`;
}
