import { useEffect, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { GlassCard } from '../../ui/GlassCard.js';
import { Icon } from '../../ui/icons.js';
import { TextField } from '../../ui/forms.js';
import { SyncDot, syncView } from '../../ui/ConnectionStatus.js';
import { showToast } from '../../ui/Toast.js';
import { online, useSignal } from '../../store/state.js';
import {
  cloudConfigured, cloudStats, createPassphrase, describeSyncError, disconnect, forgetKey,
  MIN_PASSPHRASE, refreshVaultInfo, signIn, syncNow, syncState, unlock,
} from '../../store/cloud.js';

const dateTime = new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' });
const count = new Intl.NumberFormat('it-IT');

/** "indietro di 4 min · corretto": offset = ora del server − ora del dispositivo. */
export function clockLabel(offsetMs) {
  const s = Math.round(Math.abs(offsetMs) / 1000);
  const amount = s >= 90 ? `${Math.round(s / 60)} min` : `${s} s`;
  return `${offsetMs > 0 ? 'indietro' : 'avanti'} di ${amount} · corretto`;
}

function Notice({ status = 'warning', icon = 'alert', children }) {
  return html`<div class="notice" data-status=${status}><${Icon} name=${icon} /><div>${children}</div></div>`;
}

function SignInForm({ expired }) {
  const [email, setEmail] = useState(syncState.value.email || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isOnline = useSignal(online);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError('Inserisci email e password'); return; }
    setBusy(true);
    setError('');
    try {
      await signIn(email, password);
      setPassword('');
    } catch (err) {
      setError(describeSyncError(err));
    } finally { setBusy(false); }
  };

  return html`<form class="account-form" onSubmit=${submit} noValidate>
    <p class="card-text">${expired
      ? 'La sessione è scaduta: accedi di nuovo per riprendere la sincronizzazione.'
      : 'Accedi con l’utente creato su Supabase per sincronizzare iPhone e Mac. Senza accesso l’app funziona lo stesso, solo su questo dispositivo.'}</p>
    <div class="form-grid">
      <${TextField} label="Email" type="email" value=${email} onValue=${setEmail} autocomplete="username" inputmode="email" autocapitalize="off" spellcheck=${false} />
      <${TextField} label="Password" type="password" value=${password} onValue=${setPassword} autocomplete="current-password" error=${error} />
    </div>
    <div class="settings-actions">
      <button class="btn btn--primary" type="submit" disabled=${busy || !isOnline}><${Icon} name="user" /> ${busy ? 'Accesso…' : 'Accedi'}</button>
      ${!isOnline && html`<p class="form-hint">Serve la rete per accedere.</p>`}
    </div>
  </form>`;
}

function PassphraseForm({ mode }) {
  const creating = mode === 'create';
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [remember, setRemember] = useState(true);
  const [understood, setUnderstood] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (creating) {
      if (a.length < MIN_PASSPHRASE) { setError(`Almeno ${MIN_PASSPHRASE} caratteri: meglio una frase di 4–5 parole`); return; }
      if (a !== b) { setError('Le due passphrase non coincidono'); return; }
      if (!understood) { setError('Conferma di aver capito l’avviso'); return; }
    } else if (!a) { setError('Inserisci la passphrase'); return; }
    setBusy(true);
    setError('');
    try {
      if (creating) await createPassphrase(a, { remember });
      else await unlock(a, { remember });
      setA(''); setB('');
      showToast({ message: creating ? 'Passphrase creata: sincronizzazione avviata' : 'Passphrase corretta: sincronizzazione avviata' });
    } catch (err) {
      setError(describeSyncError(err));
    } finally { setBusy(false); }
  };

  return html`<form class="account-form" onSubmit=${submit} noValidate>
    <p class="card-text">${creating
      ? 'Primo dispositivo: scegli la passphrase che cifra i dati prima di inviarli. Supabase riceve solo dati illeggibili.'
      : 'Inserisci la passphrase scelta sul primo dispositivo per leggere i dati del cloud.'}</p>
    ${creating && html`<${Notice} status="critical">
      <strong>Se perdi la passphrase, i dati nel cloud non sono recuperabili.</strong>
      Non la conosce nessun altro: né Supabase né l’app possono reimpostarla. Scrivila in un posto sicuro (es. il portachiavi di iCloud). I dati su questo dispositivo restano comunque tuoi.
    <//>`}
    <div class="form-grid settings-pass">
      <${TextField} label="Passphrase" type="password" value=${a} onValue=${setA}
        autocomplete=${creating ? 'new-password' : 'current-password'} error=${error}
        hint=${creating ? `Almeno ${MIN_PASSPHRASE} caratteri` : undefined} />
      ${creating && html`<${TextField} label="Ripeti passphrase" type="password" value=${b} onValue=${setB} autocomplete="new-password" />`}
    </div>
    <div class="checks">
      <label class="check"><input type="checkbox" checked=${remember} onChange=${(e) => setRemember(e.currentTarget.checked)} />
        <span><strong>Ricorda su questo dispositivo</strong><small>La chiave (non la passphrase) resta salvata qui in forma non esportabile: niente richiesta a ogni apertura.</small></span></label>
      ${creating && html`<label class="check"><input type="checkbox" checked=${understood} onChange=${(e) => setUnderstood(e.currentTarget.checked)} />
        <span><strong>Ho capito</strong><small>Senza passphrase i dati cifrati nel cloud sono persi per sempre.</small></span></label>`}
    </div>
    <div class="settings-actions">
      <button class="btn btn--primary" type="submit" disabled=${busy}><${Icon} name="lock" />
        ${busy ? 'Verifica…' : creating ? 'Crea passphrase e sincronizza' : 'Sblocca e sincronizza'}</button>
    </div>
  </form>`;
}

function LockedState({ state }) {
  const isOnline = useSignal(online);
  const [loading, setLoading] = useState(false);
  const load = () => {
    setLoading(true);
    refreshVaultInfo().catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { if (!state.vault && isOnline) load(); }, [state.vault, isOnline]);

  if (state.vault === 'missing') return html`<${PassphraseForm} mode="create" />`;
  if (state.vault === 'present') return html`<${PassphraseForm} mode="unlock" />`;
  return html`<div>
    <p class="card-text">${!isOnline ? 'Serve la rete per controllare la passphrase del cloud.' : loading ? 'Controllo del vault nel cloud…' : (state.error || 'Vault non disponibile.')}</p>
    ${isOnline && !loading && html`<div class="settings-actions"><button class="btn btn--secondary" type="button" onClick=${load}><${Icon} name="refresh" /> Riprova</button></div>`}
  </div>`;
}

function ConnectedState({ state }) {
  const isOnline = useSignal(online);
  const [stats, setStats] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const view = syncView(state, isOnline);

  useEffect(() => {
    if (state.phase === 'syncing') return;
    cloudStats().then(setStats).catch(() => {});
  }, [state.phase, state.lastSyncAt]);

  const onDisconnect = async () => {
    if (!confirm) { setConfirm(true); return; }
    await disconnect();
    setConfirm(false);
    showToast({ message: 'Dispositivo disconnesso: i dati restano qui', status: 'unknown' });
  };

  return html`<div>
    <div class="rows">
      <div class="row"><span class="row__label">Account</span><span class="row__value">${state.email || '—'}</span></div>
      <div class="row"><span class="row__label">Stato</span><span class="row__value"><${SyncDot} /> ${view.label}</span></div>
      <div class="row"><span class="row__label">Ultima sincronizzazione</span>
        <span class="row__value">${state.lastSyncAt ? dateTime.format(new Date(state.lastSyncAt)) : 'Mai'}</span></div>
      <div class="row"><span class="row__label">Record su questo dispositivo</span><span class="row__value">${stats ? count.format(stats.local) : '…'}</span></div>
      <div class="row"><span class="row__label">Record nel cloud</span><span class="row__value">${stats?.cloud == null ? '—' : count.format(stats.cloud)}</span></div>
      <div class="row"><span class="row__label">In attesa di invio</span><span class="row__value">${stats ? count.format(stats.pending) : '…'}</span></div>
      ${state.clockOffset !== 0 && html`<div class="row"><span class="row__label">Orologio del dispositivo</span>
        <span class="row__value">${clockLabel(state.clockOffset)}</span></div>`}
      <div class="row"><span class="row__label">Chiave di cifratura</span>
        <span class="row__value">${state.remembered ? 'Ricordata su questo dispositivo' : 'Solo fino alla chiusura'}</span></div>
    </div>
    ${state.phase === 'error' && html`<${Notice} status="critical">
      ${state.error}${state.retryAt ? html` · nuovo tentativo alle ${new Date(state.retryAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
    <//>`}
    <p class="form-hint settings-note">Sincronizza all’avvio, al ritorno della rete e ogni minuto con l’app aperta. Il cloud riceve solo dati cifrati sul dispositivo.</p>
    <div class="settings-actions">
      <button class="btn btn--primary" type="button" onClick=${() => syncNow()} disabled=${state.phase === 'syncing' || !isOnline}>
        <${Icon} name="refresh" /> ${state.phase === 'syncing' ? 'Sincronizzazione…' : 'Sincronizza ora'}</button>
      ${state.remembered && html`<button class="btn btn--secondary" type="button" onClick=${() => forgetKey().then(() => showToast({ message: 'Alla prossima apertura ti verrà chiesta la passphrase' }))}>
        <${Icon} name="lock" /> Non ricordare la chiave</button>`}
      <button class=${`btn ${confirm ? 'btn--danger' : 'btn--secondary'}`} type="button" onClick=${onDisconnect}>
        <${Icon} name="close" /> ${confirm ? 'Conferma: disconnetti' : 'Disconnetti questo dispositivo'}</button>
      ${confirm && html`<button class="btn btn--ghost" type="button" onClick=${() => setConfirm(false)}>Annulla</button>`}
    </div>
    ${confirm && html`<p class="form-hint">Esci dall’account e dimentichi la chiave su questo dispositivo. I dati locali e quelli nel cloud restano.</p>`}
  </div>`;
}

/** Impostazioni → Account e sync. */
export function AccountCard({ index = 1 }) {
  const state = useSignal(syncState);
  let body;
  if (!cloudConfigured) {
    body = html`<p class="card-text">Sincronizzazione non configurata: inserisci URL e chiave pubblica di Supabase in config.js.</p>`;
  } else if (state.phase === 'off' || state.phase === 'expired') {
    body = html`<${SignInForm} expired=${state.phase === 'expired'} />`;
  } else if (state.phase === 'locked') {
    body = html`<${LockedState} state=${state} />
      <div class="settings-actions"><button class="btn btn--ghost" type="button" onClick=${() => disconnect()}>Esci dall’account</button></div>`;
  } else {
    body = html`<${ConnectedState} state=${state} />`;
  }
  return html`<${GlassCard} class="settings-card spring-in" style=${`--i:${index}`}>
    <h2 class="card-title settings-card__title"><${Icon} name="database" /> Account e sync</h2>
    ${body}
  <//>`;
}
