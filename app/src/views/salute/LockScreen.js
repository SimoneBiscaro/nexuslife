import { useEffect, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { Icon } from '../../ui/icons.js';
import { PinPad } from '../../ui/PinPad.js';
import { hasWebAuthn, isValidPin, setPin, unlockWithPin, unlockWithWebAuthn, webAuthnAvailable } from '../../store/lock.js';

/** Primo accesso: sceglie e conferma il PIN. */
export function PinSetup({ onDone }) {
  const [first, setFirst] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (pin) => {
    if (!isValidPin(pin)) return false;
    if (first === null) { setFirst(pin); setError(''); return true; }
    if (pin !== first) { setFirst(null); setError('I due PIN non coincidono: ricomincia'); return false; }
    setBusy(true);
    await setPin(pin);
    setBusy(false);
    onDone?.();
    return true;
  };

  return html`
    <div class="lock glass" role="dialog" aria-modal="true" aria-labelledby="lock-title">
      <div class="lock__icon" aria-hidden="true"><${Icon} name="lock" /></div>
      <h2 class="lock__title" id="lock-title">${first === null ? 'Scegli un PIN per Salute' : 'Conferma il PIN'}</h2>
      <p class="lock__text">Lo chiederemo aprendo Salute dopo 5 minuti di inattività. Resta solo su questo dispositivo.</p>
      <${PinPad} key=${first === null ? 'a' : 'b'} label=${first === null ? 'Nuovo PIN' : 'Conferma PIN'} onSubmit=${submit} error=${error} busy=${busy} />
      <a class="btn btn--ghost" href="#/impostazioni">Disattiva il blocco in Impostazioni</a>
    </div>`;
}

/** Schermata di sblocco con PIN o Face ID / Touch ID. */
export function LockScreen() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [bio, setBio] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    Promise.all([webAuthnAvailable(), hasWebAuthn()]).then(([a, b]) => setBio(a && b));
  }, []);

  const submit = async (pin) => {
    setBusy(true);
    const res = await unlockWithPin(pin);
    setBusy(false);
    if (res.ok) return true;
    setError(res.waitMs ? `Troppi tentativi: riprova tra ${Math.ceil(res.waitMs / 1000)} secondi` : 'PIN errato');
    return false;
  };

  const biometric = async () => {
    try {
      if (!(await unlockWithWebAuthn())) setError('Sblocco non riuscito: usa il PIN');
    } catch {
      setError('Sblocco annullato: usa il PIN');
    }
  };

  return html`
    <div class="lock glass" role="dialog" aria-modal="true" aria-labelledby="lock-title">
      <div class="lock__icon" aria-hidden="true"><${Icon} name="lock" /></div>
      <h2 class="lock__title" id="lock-title">Salute è bloccata</h2>
      <${PinPad} label="PIN" onSubmit=${submit} error=${error} busy=${busy} />
      ${bio && html`<button class="btn btn--secondary" type="button" onClick=${biometric}><${Icon} name="faceid" /> Usa Face ID / Touch ID</button>`}
      <button class="btn btn--ghost" type="button" onClick=${() => setHelp((v) => !v)} aria-expanded=${help}>PIN dimenticato?</button>
      ${help && html`<p class="lock__text">Per sicurezza il PIN non si può recuperare. Puoi cancellare i dati locali da Impostazioni e ripristinarli da un pacchetto di backup: al riavvio sceglierai un nuovo PIN.</p>`}
    </div>`;
}
