import { useEffect, useState } from '../../vendor/preact-hooks.mjs';
import { html } from './html.js';
import { Icon } from './icons.js';
import { haptic } from './haptics.js';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];

/**
 * Tastierino per PIN di 4–6 cifre. Invio automatico alla sesta cifra, altrimenti "OK".
 * @param {{ onSubmit: (pin: string) => Promise<boolean|void>, error?: string, busy?: boolean, label: string }} props
 *   onSubmit restituisce false per svuotare il campo (PIN errato)
 */
export function PinPad({ onSubmit, error, busy, label }) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(0);

  const submit = async (value) => {
    if (busy || value.length < 4) return;
    const ok = await onSubmit(value);
    if (ok === false) { setPin(''); setShake((n) => n + 1); haptic(30); }
  };

  const press = (k) => {
    if (busy) return;
    haptic();
    if (k === 'del') { setPin((p) => p.slice(0, -1)); return; }
    if (k === 'ok') { submit(pin); return; }
    setPin((p) => {
      if (p.length >= 6) return p;
      const next = p + k;
      if (next.length === 6) setTimeout(() => submit(next), 120);
      return next;
    });
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^\d$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); press('del'); }
      else if (e.key === 'Enter') { e.preventDefault(); press('ok'); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  return html`
    <div class="pinpad">
      <div class=${`pin-dots${shake ? ' is-shaking' : ''}`} key=${shake} role="img" aria-label=${`${label}: ${pin.length} cifre inserite`}>
        ${[0, 1, 2, 3, 4, 5].map((i) => html`<span key=${i} class=${`pin-dot${i < pin.length ? ' is-on' : ''}${i >= 4 ? ' is-optional' : ''}`}></span>`)}
      </div>
      <p class=${`pin-msg${error ? ' is-error' : ''}`} role=${error ? 'alert' : undefined} aria-live="polite">
        ${busy ? 'Verifica…' : error || 'Da 4 a 6 cifre'}
      </p>
      <div class="keypad" role="group" aria-label="Tastierino del PIN">
        ${KEYS.map((k) => html`
          <button type="button" key=${k} class=${`keypad__key${k === 'ok' ? ' keypad__key--ok' : ''}`} onClick=${() => press(k)}
            disabled=${busy || (k === 'ok' && pin.length < 4)} aria-label=${k === 'del' ? 'Cancella' : k === 'ok' ? 'Conferma' : k}>
            ${k === 'del' ? html`<${Icon} name="backspace" />` : k === 'ok' ? 'OK' : k}
          </button>`)}
      </div>
    </div>`;
}
