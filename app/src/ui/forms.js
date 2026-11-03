import { useId } from '../../vendor/preact-hooks.mjs';
import { html } from './html.js';

const cleanId = (id) => id.replace(/[^a-zA-Z0-9_-]/g, '');

/**
 * Campo con etichetta, suggerimento ed errore. `render(id, describedBy)` disegna il controllo.
 */
export function Field({ label, hint, error, render, class: cls = '' }) {
  const id = `f-${cleanId(useId())}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  return html`
    <div class=${`form-field ${cls}`}>
      <label class="form-label" for=${id}>${label}</label>
      ${render(id, describedBy, Boolean(error))}
      ${hint && !error && html`<p class="form-hint" id=${hintId}>${hint}</p>`}
      ${error && html`<p class="form-error" id=${errId} role="alert">${error}</p>`}
    </div>`;
}

/** Input testuale/data/numero con stile vetro. */
export function TextField({ label, hint, error, value, onValue, type = 'text', class: cls, ...rest }) {
  return html`<${Field} label=${label} hint=${hint} error=${error} class=${cls} render=${(id, desc, invalid) => html`
    <input class="input" id=${id} type=${type} value=${value ?? ''} aria-describedby=${desc}
      aria-invalid=${invalid ? 'true' : undefined}
      onInput=${(e) => onValue?.(e.currentTarget.value)} ...${rest} />`} />`;
}

export function SelectField({ label, hint, error, value, onValue, options, class: cls }) {
  return html`<${Field} label=${label} hint=${hint} error=${error} class=${cls} render=${(id, desc) => html`
    <select class="input" id=${id} value=${value} aria-describedby=${desc} onChange=${(e) => onValue?.(e.currentTarget.value)}>
      ${options.map((o) => html`<option value=${o.value} key=${o.value}>${o.label}</option>`)}
    </select>`} />`;
}

export function TextAreaField({ label, hint, value, onValue, rows = 3 }) {
  return html`<${Field} label=${label} hint=${hint} render=${(id, desc) => html`
    <textarea class="input input--area" id=${id} rows=${rows} aria-describedby=${desc}
      onInput=${(e) => onValue?.(e.currentTarget.value)}>${value ?? ''}</textarea>`} />`;
}

/** Gruppo di scelte a pillole (radio). */
export function Segmented({ label, value, onValue, options }) {
  const name = `seg-${cleanId(useId())}`;
  return html`
    <fieldset class="segmented">
      <legend class="form-label">${label}</legend>
      <div class="segmented__track">
        ${options.map((o) => html`
          <label class=${`segmented__opt${o.value === value ? ' is-on' : ''}`} key=${o.value}>
            <input type="radio" name=${name} value=${o.value} checked=${o.value === value}
              onChange=${() => onValue(o.value)} />
            <span>${o.label}</span>
          </label>`)}
      </div>
    </fieldset>`;
}

/** Filtri a chip (scelta singola). */
export function ChipGroup({ label, value, onValue, options }) {
  return html`
    <div class="chips" role="group" aria-label=${label}>
      ${options.map((o) => html`
        <button type="button" class=${`chip${o.value === value ? ' is-on' : ''}`} key=${o.value}
          aria-pressed=${o.value === value} onClick=${() => onValue(o.value)}>${o.label}</button>`)}
    </div>`;
}
