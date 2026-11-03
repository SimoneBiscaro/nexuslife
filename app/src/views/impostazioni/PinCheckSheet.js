import { useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { Sheet } from '../../ui/Sheet.js';
import { PinPad } from '../../ui/PinPad.js';
import { checkPin } from '../../store/lock.js';

/** Chiede il PIN attuale prima di un'operazione delicata (disattivare il blocco, reimpostare il PIN). */
export function PinCheckSheet({ open, title, onClose, onConfirmed }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (pin) => {
    setBusy(true);
    const ok = await checkPin(pin);
    setBusy(false);
    if (!ok) { setError('PIN errato'); return false; }
    setError('');
    await onConfirmed();
    return true;
  };
  return html`<${Sheet} open=${open} onClose=${onClose} title=${title}>
    ${open && html`<${PinPad} label="PIN attuale" onSubmit=${submit} error=${error} busy=${busy} />`}
  <//>`;
}
