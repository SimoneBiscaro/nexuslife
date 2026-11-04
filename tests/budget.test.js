import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('../app/', import.meta.url));
const read = (p) => readFileSync(join(APP, p));

function shell() {
  const sw = read('sw.js').toString();
  return [...sw.match(/const SHELL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((p) => p !== './');
}

test('budget: app shell senza font sotto i 300 KB compressi (come la serve GitHub Pages)', () => {
  const files = shell().filter((p) => !p.includes('/fonts/'));
  let raw = 0;
  let gz = 0;
  for (const p of files) {
    const bytes = read(p);
    raw += bytes.length;
    gz += gzipSync(bytes, { level: 9 }).length;
  }
  assert.ok(gz < 300 * 1024, `shell compressa ${Math.round(gz / 1024)} KB`);
  // senza build step il codice non è minificato: un tetto anche sul peso grezzo evita derive
  assert.ok(raw < 600 * 1024, `shell non compressa ${Math.round(raw / 1024)} KB`);
});

/* ---------- Contrasto AA (CLAUDE.md §4) ---------- */
const tokens = Object.fromEntries([...read('styles/tokens.css').toString().matchAll(/--([a-z-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
// vetro chiaro più comune: bianco al 7% sopra obsidian
const glass = rgb(tokens.obsidian).map((c) => 1 * 0.07 + c * 0.93);

test('contrasto AA (≥ 4,5:1) dei colori usati per il testo, anche sul vetro', () => {
  const TEXT = ['text-primary', 'text-secondary', 'titanium-light', 'champagne', 'mint', 'amber', 'alarm-red', 'health', 'electric-blue', 'electric-blue-glow'];
  for (const name of TEXT) {
    assert.ok(tokens[name], `token ${name} mancante`);
    for (const [bgName, bg] of [['obsidian', rgb(tokens.obsidian)], ['vetro', glass], ['raised', rgb(tokens['obsidian-raised'])]]) {
      const r = ratio(rgb(tokens[name]), bg);
      assert.ok(r >= 4.5, `${name} su ${bgName}: ${r.toFixed(2)}:1`);
    }
  }
});

test('i colori sotto AA non sono usati per il testo', () => {
  const css = read('styles/components.css').toString() + read('styles/base.css').toString();
  for (const weak of ['text-tertiary', 'titanium']) {
    const re = new RegExp(`(^|[;{\\s])color:\\s*var\\(--${weak}\\)`, 'm');
    assert.ok(!re.test(css), `--${weak} usato come colore del testo`);
  }
});
