import { useEffect, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { Sheet } from '../../ui/Sheet.js';
import { Icon } from '../../ui/icons.js';
import { TextField, TextAreaField, SelectField, Segmented } from '../../ui/forms.js';
import { CalendarButton } from '../../ui/CalendarButton.js';
import { showToast } from '../../ui/Toast.js';
import { getRepo } from '../../store/repo.js';
import { isDateKey } from '../../domain/dates.js';
import { isRepeating, REPEAT_UNITS } from '../../domain/todos.js';

const formFrom = (t) => ({
  title: t?.title ?? '', dueDate: t?.dueDate ?? '', notes: t?.notes ?? '',
  repeat: isRepeating(t) ? 'yes' : 'no', repeatEvery: t?.repeatEvery ? String(t.repeatEvery) : '1', repeatUnit: t?.repeatUnit ?? 'settimane',
});

/**
 * Voce To Do: titolo, data facoltativa, ripetizione facoltativa, note.
 * @param {{ open, todo, today, onClose }} props
 */
export function TodoSheet({ open, todo, today, onClose }) {
  const [form, setForm] = useState(formFrom(todo));
  const [errors, setErrors] = useState({});
  useEffect(() => { if (open) { setForm(formFrom(todo)); setErrors({}); } }, [open, todo?.id]);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const repeat = form.repeat === 'yes';

  async function save() {
    const e = {};
    const every = Number(form.repeatEvery);
    if (!form.title.trim()) e.title = 'Cosa c\'è da fare?';
    if (form.dueDate && !isDateKey(form.dueDate)) e.dueDate = 'Data non valida';
    if (repeat && (!Number.isInteger(every) || every < 1 || every > 365)) e.repeatEvery = 'Da 1 a 365';
    setErrors(e);
    if (Object.keys(e).length) return;
    const fields = {
      title: form.title.trim(), dueDate: form.dueDate || null, notes: form.notes.trim(),
      repeatEvery: repeat ? every : null, repeatUnit: repeat ? form.repeatUnit : null,
      ...(repeat ? { doneAt: null } : {}),
    };
    const repo = await getRepo();
    if (todo) await repo.update('todo', todo.id, fields);
    else await repo.create('todo', { ...fields, doneAt: null });
    onClose();
  }

  async function remove() {
    const repo = await getRepo();
    await repo.softDelete('todo', todo.id);
    onClose();
    showToast({ message: `${todo.title} eliminato`, onAction: () => repo.update('todo', todo.id, { deleted: false }) });
  }

  const footer = html`
    ${todo && html`<button class="btn btn--danger footer-start" type="button" onClick=${remove}><${Icon} name="trash" /> Elimina</button>`}
    <button class="btn btn--secondary" type="button" onClick=${onClose}>Annulla</button>
    <button class="btn btn--primary" type="button" onClick=${save}>Salva</button>`;

  return html`
    <${Sheet} open=${open} onClose=${onClose} title=${todo ? 'To Do' : 'Nuovo To Do'} footer=${footer}>
      <form class="form-grid" onSubmit=${(ev) => { ev.preventDefault(); save(); }} noValidate>
        <${TextField} label="Cosa" value=${form.title} onValue=${set('title')} error=${errors.title} class="span-2" data-autofocus />
        <${TextField} label="Entro quando" type="date" value=${form.dueDate} onValue=${set('dueDate')} error=${errors.dueDate}
          hint="Facoltativa" class="span-2" />
        <div class="span-2"><${Segmented} label="Si ripete" value=${form.repeat} onValue=${set('repeat')}
          options=${[{ value: 'no', label: 'Una volta' }, { value: 'yes', label: 'Si ripete' }]} /></div>
        ${repeat && html`
          <${TextField} label="Ogni" value=${form.repeatEvery} onValue=${set('repeatEvery')} error=${errors.repeatEvery} inputmode="numeric" />
          <${SelectField} label="Unità" value=${form.repeatUnit} onValue=${set('repeatUnit')}
            options=${REPEAT_UNITS.map((u) => ({ value: u, label: u[0].toUpperCase() + u.slice(1) }))} />
          <p class="form-hint span-2">Quando la segni fatta, la prossima data parte dal giorno in cui l'hai fatta.</p>`}
        <div class="span-2"><${TextAreaField} label="Note" value=${form.notes} onValue=${set('notes')} rows=${2} /></div>
        <button type="submit" hidden></button>
      </form>
      ${todo?.dueDate && html`<div class="sheet-actions"><${CalendarButton} uid=${`todo-${todo.id}`} /></div>`}
    <//>`;
}
