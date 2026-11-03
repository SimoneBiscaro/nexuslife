import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('../app/', import.meta.url));
const sw = readFileSync(join(APP, 'sw.js'), 'utf8');

function shellList() {
  const block = sw.match(/const SHELL = \[([\s\S]*?)\];/);
  assert.ok(block, 'SHELL non trovato in sw.js');
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// File presenti in app/ ma volutamente fuori dall'app shell.
const EXCLUDED = [/^sw\.js$/, /\.gitkeep$/, /\.txt$/, /^assets\//];

test('sw.js dichiara CACHE_VERSION', () => {
  assert.match(sw, /const CACHE_VERSION = '[^']+';/);
});

test('ogni file dell\'app shell esiste', () => {
  for (const p of shellList()) {
    if (p === './') continue;
    assert.ok(existsSync(join(APP, p)), `manca ${p}`);
  }
});

test('ogni file dell\'app è nella cache dell\'app shell', () => {
  const listed = new Set(shellList());
  const files = walk(APP)
    .map((f) => relative(APP, f).split(sep).join('/'))
    .filter((f) => !EXCLUDED.some((re) => re.test(f)));
  const missing = files.filter((f) => !listed.has(`./${f}`));
  assert.deepEqual(missing, [], `file non in SHELL: ${missing.join(', ')}`);
});

test('nessun import da URL esterni nei moduli', () => {
  const offenders = walk(APP)
    .filter((f) => /\.(m?js|html|css)$/.test(f))
    .filter((f) => /(from\s*["']https?:|import\(\s*["']https?:|url\(\s*["']?https?:|(src|href)=["']https?:)/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(offenders.map((f) => relative(APP, f)), []);
});

test('il manifest è valido e usa percorsi relativi', () => {
  const m = JSON.parse(readFileSync(join(APP, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.name, 'NexusLife');
  assert.equal(m.display, 'standalone');
  assert.equal(m.background_color, '#0A0A0C');
  assert.equal(m.theme_color, '#0A0A0C');
  assert.ok(m.start_url.startsWith('./') && m.scope.startsWith('./'));
  const sizes = m.icons.map((i) => `${i.sizes}:${i.purpose}`);
  for (const s of ['192x192:any', '512x512:any', '512x512:maskable']) assert.ok(sizes.includes(s), `icona ${s} mancante`);
  for (const i of m.icons) assert.ok(existsSync(join(APP, i.src)), `manca ${i.src}`);
});
