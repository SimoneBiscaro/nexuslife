/*
 * Aspetto (CLAUDE.md §5): stile (struttura) + tema (palette).
 * La scelta sta in settings.appearanceStyle / settings.appearanceTheme (sincronizzati) ed è
 * copiata in localStorage, che legge src/appearance-boot.js prima del primo disegno.
 * Questo modulo è puro nella parte di catalogo (testato con node --test).
 */

export const STORAGE_KEY = 'nexus.appearance';
export const DEFAULT_STYLE = 'spatial';
export const DEFAULT_THEME = 'obsidian';
/** Senza conferma, una prova torna indietro da sola dopo questi secondi. */
export const PREVIEW_SECONDS = 15;

/**
 * Catalogo: ogni tema ha il colore della barra di stato (meta theme-color) e lo schema chiaro/scuro.
 * I CSS sono in styles/tokens.css (stile 0) e styles/styles/<id>.css.
 */
export const STYLES = [
  {
    id: 'spatial', name: 'Spatial Glass', file: null,
    description: 'Il vetro scuro originale: card sospese, riflessi champagne, anelli luminosi.',
    themes: [{ id: 'obsidian', name: 'Obsidian', color: '#0A0A0C', scheme: 'dark' }],
  },
  {
    id: 'liquid', name: 'Vetro liquido', file: 'liquid',
    description: 'Lenti di vetro chiare e luminose, bordi lucidi, raggi morbidi come su iOS.',
    themes: [
      { id: 'giorno', name: 'Giorno', color: '#E9EEF6', scheme: 'light' },
      { id: 'notte', name: 'Notte', color: '#0B1020', scheme: 'dark' },
      { id: 'aurora', name: 'Aurora', color: '#E2F3EF', scheme: 'light' },
      { id: 'grafite', name: 'Grafite', color: '#1C1E22', scheme: 'dark' },
    ],
  },
  {
    id: 'editoriale', name: 'Editoriale', file: 'editoriale',
    description: 'Neo-brutalista: titoli enormi, bordi netti, ombre piene, colori pieni senza bagliori.',
    themes: [
      { id: 'carta', name: 'Carta', color: '#F4F1EA', scheme: 'light' },
      { id: 'inchiostro', name: 'Inchiostro', color: '#111111', scheme: 'dark' },
      { id: 'klein', name: 'Klein', color: '#14209A', scheme: 'dark' },
      { id: 'rosa', name: 'Rosa', color: '#FFD9E1', scheme: 'light' },
    ],
  },
  {
    id: 'washi', name: 'Washi', file: 'washi',
    description: 'Carta giapponese: fibra leggera, linee d\'inchiostro sottili, tanto spazio, ritmo lento.',
    themes: [
      { id: 'kinari', name: 'Kinari', color: '#F3EEE3', scheme: 'light' },
      { id: 'sumi', name: 'Sumi', color: '#17150F', scheme: 'dark' },
      { id: 'sakura', name: 'Sakura', color: '#F7EBEC', scheme: 'light' },
      { id: 'matcha', name: 'Matcha', color: '#EDF0E1', scheme: 'light' },
    ],
  },
  {
    id: 'cockpit', name: 'Cockpit', file: 'cockpit',
    description: 'Strumentazione dell\'auto: nero opaco, linee HUD, cifre condensate, angoli smussati.',
    themes: [
      { id: 'notturno', name: 'Notturno', color: '#07080A', scheme: 'dark' },
      { id: 'sport', name: 'Sport', color: '#0A0707', scheme: 'dark' },
      { id: 'artico', name: 'Artico', color: '#05090D', scheme: 'dark' },
      { id: 'giorno', name: 'Giorno', color: '#E8EBEF', scheme: 'light' },
    ],
  },
  {
    id: 'clay', name: 'Clay', file: 'clay',
    description: 'Argilla morbida: forme tonde, pastelli, ombre tattili e pressioni che rimbalzano.',
    themes: [
      { id: 'pesca', name: 'Pesca', color: '#F6E5DA', scheme: 'light' },
      { id: 'lavanda', name: 'Lavanda', color: '#EAE5F6', scheme: 'light' },
      { id: 'menta', name: 'Menta', color: '#DFF1E8', scheme: 'light' },
      { id: 'notte', name: 'Notte', color: '#27242F', scheme: 'dark' },
    ],
  },
];

export const findStyle = (id) => STYLES.find((s) => s.id === id) || null;

/**
 * Coppia valida stile/tema: uno stile sconosciuto torna allo stile 0, un tema sconosciuto al primo dello stile.
 * @returns {{ style: string, theme: string, color: string, scheme: 'light'|'dark' }}
 */
export function resolveAppearance(style, theme) {
  const s = findStyle(style) || findStyle(DEFAULT_STYLE);
  const t = s.themes.find((x) => x.id === theme) || s.themes[0];
  return { style: s.id, theme: t.id, color: t.color, scheme: t.scheme };
}

/** Nome leggibile: "Washi · Sumi". */
export function appearanceLabel(style, theme) {
  const r = resolveAppearance(style, theme);
  const s = findStyle(r.style);
  return s.themes.length > 1 ? `${s.name} · ${s.themes.find((t) => t.id === r.theme).name}` : s.name;
}

/* ---------- Applicazione al documento (solo browser) ---------- */

/** Imposta data-style/data-theme, color-scheme e la barra di stato. */
export function applyAppearance(style, theme, doc = globalThis.document) {
  const r = resolveAppearance(style, theme);
  if (!doc) return r;
  const root = doc.documentElement;
  if (root.dataset.style !== r.style) root.dataset.style = r.style;
  if (root.dataset.theme !== r.theme) root.dataset.theme = r.theme;
  root.style.colorScheme = r.scheme;
  doc.querySelector('meta[name="theme-color"]')?.setAttribute('content', r.color);
  doc.querySelector('meta[name="color-scheme"]')?.setAttribute('content', r.scheme);
  return r;
}

/** Copia in localStorage per il prossimo avvio (letta da appearance-boot.js). */
export function rememberAppearance(r) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify({ style: r.style, theme: r.theme, color: r.color, scheme: r.scheme }));
  } catch { /* archiviazione non disponibile: si riparte dallo stile 0 */ }
}

/** Applica e ricorda la scelta salvata nelle impostazioni (anche quando arriva dal sync). */
export function syncAppearanceFromSettings(settings) {
  const r = applyAppearance(settings?.appearanceStyle, settings?.appearanceTheme);
  rememberAppearance(r);
  return r;
}
