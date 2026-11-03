import { html } from './html.js';
import { Icon } from './icons.js';
import { showToast } from './Toast.js';
import { addToCalendar } from '../store/calendar.js';

/** Pulsante "Aggiungi al Calendario" per una singola scadenza. */
export function CalendarButton({ uid, class: cls = 'btn btn--secondary' }) {
  const onClick = async () => {
    try {
      const ok = await addToCalendar(uid);
      if (!ok) showToast({ message: 'Questa scadenza è già passata: niente da aggiungere', status: 'unknown', duration: 3000 });
    } catch (err) {
      console.error(err);
      showToast({ message: 'Impossibile creare il file del calendario', status: 'critical' });
    }
  };
  return html`<button class=${cls} type="button" onClick=${onClick}><${Icon} name="calendar" /> Aggiungi al Calendario</button>`;
}
