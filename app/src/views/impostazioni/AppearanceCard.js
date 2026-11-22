import { html } from '../../ui/html.js';
import { GlassCard } from '../../ui/GlassCard.js';
import { Icon } from '../../ui/icons.js';
import { StylePreview } from '../../ui/StylePreview.js';
import { useSignal } from '../../store/state.js';
import { STYLES, appearanceLabel, resolveAppearance, PREVIEW_SECONDS } from '../../ui/appearance.js';
import { savedAppearance, startTrial, trial } from '../../ui/AppearanceTrial.js';

/**
 * Impostazioni → Aspetto: galleria degli stili con anteprima live e i temi di ciascuno.
 * Un tocco prova lo stile su tutta l'app; "Mantieni" lo salva (sincronizzato con gli altri dispositivi).
 * @param {{ settings: object, index: number }} props
 */
export function AppearanceCard({ settings, index }) {
  const t = useSignal(trial);
  const saved = useSignal(savedAppearance);
  const current = resolveAppearance(settings.appearanceStyle ?? saved.style, settings.appearanceTheme ?? saved.theme);
  const shown = t ? { style: t.style, theme: t.theme } : current;

  return html`<${GlassCard} class="settings-card appearance spring-in" style=${`--i:${index}`}>
    <h2 class="card-title settings-card__title"><${Icon} name="layers" /> Aspetto</h2>
    <p class="card-text">In uso: <strong>${appearanceLabel(current.style, current.theme)}</strong>. Tocca uno stile o un tema per provarlo
      su tutta l'app: se non scegli "Mantieni", dopo ${PREVIEW_SECONDS} secondi torna com'era.</p>
    <ul class="appearance__grid">
      ${STYLES.map((s) => {
        const active = shown.style === s.id;
        const theme = active ? shown.theme : (current.style === s.id ? current.theme : s.themes[0].id);
        return html`<li key=${s.id} class=${`appearance__item${active ? ' is-on' : ''}`}>
          <button class="appearance__tile" type="button" aria-pressed=${active} onClick=${() => startTrial(s.id, theme)}
            aria-label=${`Prova lo stile ${s.name}${s.themes.length > 1 ? `, tema ${s.themes.find((x) => x.id === theme).name}` : ''}. ${s.description}`}>
            <${StylePreview} style=${s.id} theme=${theme} />
            <span class="appearance__name">${s.name}${s.id === 'spatial' ? html` <span class="tag">predefinito</span>` : ''}</span>
            <span class="appearance__desc">${s.description}</span>
          </button>
          ${s.themes.length > 1 && html`<div class="appearance__themes" role="group" aria-label=${`Temi di ${s.name}`}>
            ${s.themes.map((th) => html`<button key=${th.id} type="button" class=${`appearance__theme${active && shown.theme === th.id ? ' is-on' : ''}`}
              aria-pressed=${active && shown.theme === th.id} onClick=${() => startTrial(s.id, th.id)}>
              <span class="appearance__dot" data-style=${s.id} data-theme=${th.id} aria-hidden="true"></span>${th.name}
            </button>`)}
          </div>`}
        </li>`;
      })}
    </ul>
    <div class="settings-actions">
      <a class="btn btn--secondary" href="#/impostazioni/design"><${Icon} name="sparkle" /> Catalogo dei componenti</a>
    </div>
  <//>`;
}
