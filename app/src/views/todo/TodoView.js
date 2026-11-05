import { useEffect, useRef, useState } from '../../../vendor/preact-hooks.mjs';
import { html } from '../../ui/html.js';
import { PageHeader, EmptyState, EmptyNote, Skeleton } from '../../ui/Page.js';
import { GlassCard } from '../../ui/GlassCard.js';
import { NeonBadge } from '../../ui/NeonBadge.js';
import { Icon } from '../../ui/icons.js';
import { showToast } from '../../ui/Toast.js';
import { haptic } from '../../ui/haptics.js';
import { formatDueDate } from '../../ui/format.js';
import { ProgressiveList } from '../../ui/incremental.js';
import { memo } from '../../ui/memo.js';
import { useEntities } from '../../store/queries.js';
import { getRepo } from '../../store/repo.js';
import { toDateKey } from '../../domain/dates.js';
import { daysLabel } from '../../domain/overview.js';
import { markTodoDone, parseTodoInput, repeatLabel, sortTodos, TODO_DONE_KEEP_DAYS } from '../../domain/todos.js';
import { TodoSheet } from './TodoSheet.js';

const ENTITIES = ['todo'];

/** Segna fatta (o riapre) una voce, con "Annulla" per 5 secondi. */
export async function toggleTodo(todo, done, today) {
  const repo = await getRepo();
  if (done) { await repo.update('todo', todo.id, { doneAt: null }); return; }
  const patch = markTodoDone(todo, today);
  const before = Object.fromEntries(Object.keys(patch).map((k) => [k, todo[k] ?? null]));
  await repo.update('todo', todo.id, patch);
  haptic();
  showToast({
    message: patch.dueDate ? `${todo.title}: fatto, prossima ${formatDueDate(patch.dueDate, today)}` : `${todo.title}: fatto`,
    onAction: () => repo.update('todo', todo.id, before),
  });
}

/** Aggiunta rapida: "Chiamare il barbiere domani" → voce con data. */
export function TodoQuickAdd({ today, autoFocus = false }) {
  const [text, setText] = useState('');
  const inputRef = useRef(null);
  const parsed = text.trim() ? parseTodoInput(text, today) : null;
  useEffect(() => { if (autoFocus && matchMedia('(min-width: 900px)').matches) inputRef.current?.focus({ preventScroll: true }); }, []);

  async function submit(e) {
    e.preventDefault();
    if (!parsed?.title) return;
    const repo = await getRepo();
    await repo.create('todo', { title: parsed.title, dueDate: parsed.dueDate, notes: '', doneAt: null, repeatEvery: null, repeatUnit: null });
    haptic();
    setText('');
    inputRef.current?.focus({ preventScroll: true });
  }

  return html`
    <form class="quick-add glass todo-add" onSubmit=${submit} aria-label="Aggiungi un To Do">
      <div class="quick-add__row">
        <${Icon} name="plus" class="quick-add__icon" />
        <label class="sr-only" for="todo-add-input">Aggiungi un To Do</label>
        <input id="todo-add-input" ref=${inputRef} class="quick-add__input" data-search=${autoFocus ? '' : undefined} value=${text} autocomplete="off"
          placeholder="Aggiungi… es. chiamare il barbiere domani" enterkeyhint="done" aria-describedby="todo-add-help"
          onInput=${(e) => setText(e.currentTarget.value)} />
        <button class="btn btn--primary quick-add__go" type="submit" disabled=${!parsed?.title} aria-label="Aggiungi"><${Icon} name="plus" /></button>
      </div>
      <p class="quick-add__help" id="todo-add-help" aria-live="polite">${parsed?.dueDate
        ? html`<span><b>${parsed.title}</b> · entro ${formatDueDate(parsed.dueDate, today)}</span>`
        : html`<span>In fondo: <b>oggi</b>, <b>domani</b>, <b>venerdì</b>, <b>tra 2 settimane</b>, <b>12/11</b></span>`}</p>
    </form>`;
}

export const TodoRow = memo(function TodoRow({ x, today, onOpen }) {
  const { todo, done, status, days } = x;
  const repeat = repeatLabel(todo);
  const meta = [
    done ? `fatto ${formatDueDate(todo.doneAt, today)}` : todo.dueDate ? `entro ${formatDueDate(todo.dueDate, today)}` : 'senza data',
    repeat, todo.notes,
  ].filter(Boolean).join(' · ');
  return html`<li class=${`todo-row${done ? ' is-done' : ''}`}>
    <button type="button" class="g-item__check" aria-pressed=${done} onClick=${() => toggleTodo(todo, done, today)}
      aria-label=${done ? `Riapri ${todo.title}` : `Segna ${todo.title} come fatto`}><${Icon} name="check" /></button>
    <button class="item-row" type="button" onClick=${() => onOpen(todo)}>
      <span class="item-row__main">
        <span class="item-row__title">${todo.title}</span>
        <span class="item-row__meta">${meta}</span>
      </span>
      ${!done && todo.dueDate && html`<${NeonBadge} status=${status}>${daysLabel(days)}<//>`}
    </button>
  </li>`;
});

export function TodoView() {
  const today = toDateKey(new Date());
  const { data, error } = useEntities(ENTITIES);
  const [editing, setEditing] = useState(undefined);
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    const onNew = () => setEditing(null);
    window.addEventListener('nexus:new', onNew);
    return () => window.removeEventListener('nexus:new', onNew);
  }, []);

  const header = html`<${PageHeader} eyebrow="Cose da fare" title="To Do" />`;
  if (error) {
    return html`${header}<${EmptyState} icon="alert" title="Archivio non disponibile"
      text="Questo browser non permette di salvare dati (per esempio in navigazione privata)." />`;
  }
  if (!data) return html`${header}<${Skeleton} cards=${1} label="Caricamento dei To Do" />`;

  const { open, done } = sortTodos(data.todos, today);
  const late = open.filter((x) => x.status === 'overdue').length;

  return html`
    ${header}
    <div class="quick-add-wrap"><${TodoQuickAdd} today=${today} autoFocus /></div>
    ${open.length === 0 && done.length === 0
      ? html`<${GlassCard} class="spring-in"><${EmptyState} art="oggi" accent="var(--champagne)" title="Niente da fare"
          text="Qui vanno le scadenze che non stanno in Auto, Casa, Spesa o Salute: chiamare il barbiere, pagare una multa, un regalo.">
          <button class="btn btn--primary empty-state__cta" type="button" onClick=${() => setEditing(null)}><${Icon} name="plus" /> Nuovo To Do</button>
        <//><//>`
      : html`
        <${GlassCard} class="spring-in" style="--i:0">
          <div class="card-head">
            <div>
              <h2 class="card-title">Da fare</h2>
              <p class="card-text">${open.length === 0 ? 'Tutto fatto' : `${open.length} ${open.length === 1 ? 'voce' : 'voci'}${late ? ` · ${late} in ritardo` : ''}`}</p>
            </div>
            <button class="btn btn--secondary" type="button" onClick=${() => setEditing(null)} aria-keyshortcuts="N"><${Icon} name="plus" /> Nuovo</button>
          </div>
          ${open.length
            ? html`<${ProgressiveList} class="item-list" items=${open} renderItem=${(x) => html`<${TodoRow} key=${x.todo.id} x=${x} today=${today} onOpen=${setEditing} />`} />`
            : html`<${EmptyNote} art="oggi" accent="var(--champagne)">Nessuna voce aperta. Aggiungine una qui sopra.<//>`}
          ${done.length > 0 && html`
            <button class="btn btn--ghost todo-done-toggle" type="button" aria-expanded=${showDone} onClick=${() => setShowDone(!showDone)}>
              <${Icon} name=${showDone ? 'up' : 'down'} /> Fatte (${done.length})
            </button>
            ${showDone && html`<ul class="item-list">${done.map((x) => html`<${TodoRow} key=${x.todo.id} x=${x} today=${today} onOpen=${setEditing} />`)}</ul>
              <p class="card-text todo-done-note">Le voci fatte spariscono da sole dopo ${TODO_DONE_KEEP_DAYS} giorni.</p>`}`}
        <//>`}
    <${TodoSheet} open=${editing !== undefined} todo=${editing || null} today=${today} onClose=${() => setEditing(undefined)} />`;
}
