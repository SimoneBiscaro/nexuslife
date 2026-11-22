import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STYLES, resolveAppearance, appearanceLabel, DEFAULT_STYLE, DEFAULT_THEME } from '../app/src/ui/appearance.js';

const APP = fileURLToPath(new URL('../app/', import.meta.url));
const read = (p) => readFileSync(join(APP, p), 'utf8');

/* ---------- Lettura dei token dai CSS ---------- */
function blocks(css) {
  const out = [];
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = m[1].trim().split(',').map((x) => x.trim());
    const decls = {};
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':');
      if (i < 0 || d.includes('!important')) continue;
      const name = d.slice(0, i).trim();
      if (name.startsWith('--') || name === 'color-scheme') decls[name] = d.slice(i + 1).trim();
    }
    out.push({ selectors, decls });
  }
  return out;
}

const ALL = [read('styles/tokens.css'), ...STYLES.filter((s) => s.file).map((s) => read(`styles/styles/${s.file}.css`))].flatMap(blocks);

/** Token risolti per uno stile/tema, nello stesso ordine della cascata. */
function tokensFor(style, theme) {
  const t = {};
  const own = `[data-style="${style}"]`;
  const themed = `[data-style="${style}"][data-theme="${theme}"]`;
  for (const level of [(s) => s === '[data-style]', (s) => s === own, (s) => s === themed]) {
    for (const b of ALL) if (b.selectors.some(level)) Object.assign(t, b.decls);
  }
  return t;
}

function resolve(t, name, depth = 0) {
  const v = t[name];
  if (v === undefined || depth > 8) return undefined;
  const m = /^var\((--[a-z0-9-]+)\)$/.exec(v);
  return m ? resolve(t, m[1], depth + 1) : v;
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const mix = (a, b, p) => a.map((c, i) => c * (1 - p) + b[i] * p);
function lab(c) {
  const [r, g, b] = c.map(lin);
  const f = (x) => (x > 216 / 24389 ? Math.cbrt(x) : (24389 / 27 * x + 16) / 116);
  const X = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const Y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const Z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}
const deltaE = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));

const PALETTE = ['bg', 'bg-elevated', 'bg-raised', 'surface', 'surface-deep', 'scrim', 'neutral-deep', 'neutral', 'neutral-light',
  'neutral-specular', 'pearl', 'accent', 'accent-light', 'accent-deep', 'on-accent', 'blue', 'blue-glow', 'green', 'amber', 'red',
  'red-light', 'pink', 'violet', 'teal', 'booked', 'text-primary', 'text-secondary', 'text-tertiary', 'ink', 'shade', 'theme-color'];
const TEXT = ['text-primary', 'text-secondary', 'neutral-light', 'accent', 'accent-light', 'green', 'amber', 'red', 'red-light', 'pink', 'blue', 'blue-glow', 'booked'];
const STRUCTURE = ['font-ui', 'font-display', 'font-num', 'radius-sm', 'radius-lg', 'glass-bg', 'glass-border', 'glass-shadow', 'glass-blur',
  'gauge-stroke', 'gauge-cap', 'glow', 'dur-spring', 'ease-spring', 'title-fill', 'page-bg', 'btn-primary-bg'];
const PAIRS = STYLES.flatMap((s) => s.themes.map((t) => ({ style: s, theme: t })));

test('catalogo: 6 stili (lo 0 più 5 nuovi), 3–4 temi per ogni stile nuovo, file presenti', () => {
  assert.equal(STYLES[0].id, DEFAULT_STYLE);
  assert.equal(STYLES[0].themes[0].id, DEFAULT_THEME);
  assert.equal(STYLES.length, 6);
  for (const s of STYLES.slice(1)) {
    assert.ok(s.themes.length >= 3 && s.themes.length <= 4, `${s.id}: ${s.themes.length} temi`);
    assert.ok(existsSync(join(APP, `styles/styles/${s.file}.css`)), `${s.file}.css mancante`);
    assert.ok(read('sw.js').includes(`'./styles/styles/${s.file}.css'`), `${s.file}.css non in SHELL`);
    assert.ok(read('index.html').includes(`href="./styles/styles/${s.file}.css"`), `${s.file}.css non collegato in index.html`);
  }
});

test('ripiego: stile o tema sconosciuti tornano a valori validi', () => {
  assert.deepEqual(resolveAppearance('boh', 'x'), { style: 'spatial', theme: 'obsidian', color: '#0A0A0C', scheme: 'dark' });
  assert.equal(resolveAppearance('washi', 'x').theme, 'kinari');
  assert.equal(resolveAppearance('washi', 'sumi').scheme, 'dark');
  assert.equal(appearanceLabel('washi', 'sumi'), 'Washi · Sumi');
  assert.equal(appearanceLabel('spatial', 'obsidian'), 'Spatial Glass');
});

for (const { style, theme } of PAIRS) {
  const name = `${style.id} · ${theme.id}`;
  test(`tema ${name}: token completi, contrasto AA, stati distinguibili`, () => {
    const t = tokensFor(style.id, theme.id);
    for (const k of STRUCTURE) assert.ok(t[`--${k}`], `${name}: --${k} mancante`);
    const c = {};
    for (const k of PALETTE) {
      const v = resolve(t, `--${k}`);
      assert.match(v ?? '', /^#[0-9A-Fa-f]{6}$/, `${name}: --${k} = ${v}`);
      c[k] = rgb(v);
    }
    assert.equal(resolve(t, '--theme-color').toUpperCase(), theme.color.toUpperCase(), `${name}: theme-color diverso dal catalogo`);
    assert.equal(t['color-scheme'], theme.scheme, `${name}: color-scheme`);
    // fondi su cui sta il testo: pagina, card piene, superfici rialzate e vetro chiaro (ink al 7%)
    const grounds = { bg: c.bg, elevated: c['bg-elevated'], raised: c['bg-raised'], vetro: mix(c.bg, c.ink, 0.07) };
    for (const k of TEXT) {
      for (const [g, bg] of Object.entries(grounds)) {
        const r = contrast(c[k], bg);
        assert.ok(r >= 4.5, `${name}: --${k} su ${g} ${r.toFixed(2)}:1`);
      }
    }
    assert.ok(contrast(c['on-accent'], c.accent) >= 4.5, `${name}: testo sul pulsante primario ${contrast(c['on-accent'], c.accent).toFixed(2)}:1`);
    // stati: ok / warning / critical / booked / unknown riconoscibili tra loro
    const states = { ok: c.green, warning: c.amber, critical: c.red, booked: c.booked, unknown: c['neutral-light'] };
    const keys = Object.keys(states);
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const d = deltaE(states[keys[i]], states[keys[j]]);
        assert.ok(d >= 20, `${name}: ${keys[i]} e ${keys[j]} troppo simili (ΔE ${d.toFixed(1)})`);
      }
    }
  });
}

test('nessun colore fisso nei componenti: solo token', () => {
  const css = read('styles/components.css') + read('styles/base.css');
  const hits = css.replace(/\/\*[\s\S]*?\*\//g, '').match(/#[0-9A-Fa-f]{3,8}\b|rgba?\(\s*\d/g) || [];
  assert.deepEqual(hits, [], 'colori fissi in components.css/base.css');
  const files = ['ui/HudGauge.js', 'ui/Bouquet.js', 'ui/NeonBadge.js', 'ui/Background.js', 'ui/icons.js', 'ui/Banner.js',
    'ui/StylePreview.js', 'views/impostazioni/DesignView.js', 'views/impostazioni/AppearanceCard.js'];
  for (const f of files) {
    const src = read(`src/${f}`);
    const found = src.match(/#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b(?![0-9A-Za-z-])|rgba?\(\s*\d/g) || [];
    assert.deepEqual(found, [], `colori fissi in ${f}`);
  }
  // DigitalTwin: l'unica eccezione è la tinta della carrozzeria (dato del veicolo, PAINT)
  const twin = read('src/ui/DigitalTwin.js').replace(/const PAINTS = \{[\s\S]*?\};/, '');
  assert.deepEqual(twin.match(/#[0-9A-Fa-f]{3,6}\b|rgba?\(\s*\d/g) || [], [], 'colori fissi nel DigitalTwin');
});
