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
  // (alzato da 600 a 750 KB con la Fase 9; il tetto compresso resta 300 KB)
  assert.ok(raw < 750 * 1024, `shell non compressa ${Math.round(raw / 1024)} KB`);
});

/* ---------- Contrasto AA (CLAUDE.md §4): per ogni stile e tema in tests/themes.test.js ---------- */

test('i colori sotto AA non sono usati per il testo', () => {
  const css = read('styles/components.css').toString() + read('styles/base.css').toString();
  for (const weak of ['text-tertiary', 'neutral']) {
    const re = new RegExp(`(^|[;{\\s])color:\\s*var\\(--${weak}\\)`, 'm');
    assert.ok(!re.test(css), `--${weak} usato come colore del testo`);
  }
});
