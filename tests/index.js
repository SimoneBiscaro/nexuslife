/*
 * Punto d'ingresso per `node --test tests/`.
 * Da Node 21 un percorso di cartella non viene più espanso: Node carica questo file,
 * che importa tutti i *.test.js. Su Node 20 la cartella viene invece scansionata
 * direttamente e questo file (che non corrisponde al pattern dei test) viene ignorato.
 */
import { readdirSync } from 'node:fs';

const dir = new URL('./', import.meta.url);
for (const name of readdirSync(dir).filter((f) => f.endsWith('.test.js')).sort()) {
  await import(new URL(name, dir));
}
