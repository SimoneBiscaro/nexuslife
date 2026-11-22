/*
 * NexusLife — aspetto prima del primo disegno.
 * Script classico (non modulo: i moduli sono differiti e lascerebbero vedere il tema predefinito
 * per un istante). Caricato nel <head> prima dei CSS, consentito dal CSP (script-src 'self').
 * Legge la scelta copiata da src/ui/appearance.js; senza archiviazione resta lo stile 0.
 */
(function () {
  var root = document.documentElement;
  var a = null;
  try { a = JSON.parse(localStorage.getItem('nexus.appearance') || 'null'); } catch (e) { a = null; }
  var ok = function (v) { return typeof v === 'string' && /^[a-z]{2,20}$/.test(v); };
  if (!a || !ok(a.style) || !ok(a.theme)) a = { style: 'spatial', theme: 'obsidian', color: '#0A0A0C', scheme: 'dark' };
  root.setAttribute('data-style', a.style);
  root.setAttribute('data-theme', a.theme);
  var scheme = a.scheme === 'light' ? 'light' : 'dark';
  root.style.colorScheme = scheme;
  var color = /^#[0-9A-Fa-f]{6}$/.test(a.color || '') ? a.color : '#0A0A0C';
  var metas = document.getElementsByTagName('meta');
  for (var i = 0; i < metas.length; i++) {
    if (metas[i].name === 'theme-color') metas[i].setAttribute('content', color);
    if (metas[i].name === 'color-scheme') metas[i].setAttribute('content', scheme);
  }
}());
