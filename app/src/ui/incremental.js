import { h } from '../../vendor/preact.mjs';
import { useEffect, useState } from '../../vendor/preact-hooks.mjs';
import { memo } from './memo.js';

/**
 * Rendering progressivo delle liste lunghe: le prime `first` righe subito, poi blocchi da `step`
 * a ogni frame. Così aprire una lista da 500 elementi non blocca l'interfaccia (nessun long task).
 * @param {number} total numero di elementi
 * @returns {number} quanti elementi disegnare adesso
 */
export function useIncremental(total, { first = 16, step = 12 } = {}) {
  const [shown, setShown] = useState(Math.min(total, first));
  useEffect(() => {
    if (shown >= total) return undefined;
    // Il blocco successivo arriva quando il browser è libero (input, paint e raster del frame
    // precedente finiti): così il thread principale non resta mai bloccato a lungo.
    const next = () => setShown((n) => Math.min(total, n + step));
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(next, { timeout: 250 });
      return () => cancelIdleCallback(id);
    }
    const timer = setTimeout(next, 32); // Safari: niente requestIdleCallback
    return () => clearTimeout(timer);
  }, [shown, total]);
  return Math.min(Math.max(shown, Math.min(total, first)), total);
}

/** Un blocco di righe: memo, così i blocchi già disegnati non si ricalcolano quando ne arriva uno nuovo. */
const Block = memo(function Block({ items, start, end, renderItem }) {
  const out = [];
  for (let i = start; i < end; i++) out.push(renderItem(items[i], i));
  return out;
});

/**
 * Lista disegnata a blocchi (vedi useIncremental): ogni frame aggiunge un blocco nuovo senza
 * ricostruire le righe precedenti, quindi il costo per frame resta costante anche con 500 elementi.
 * @param {{ items: any[], renderItem: (item: any, i: number) => any, tag?: string, first?: number, step?: number }} props
 */
export function ProgressiveList({ items, renderItem, tag = 'ul', first = 16, step = 12, ...rest }) {
  const shown = useIncremental(items.length, { first, step });
  const blocks = [];
  for (let start = 0, end = Math.min(first, shown); start < shown; start = end, end = Math.min(start + step, shown)) {
    blocks.push(h(Block, { key: start, items, start, end, renderItem }));
  }
  return h(tag, rest, blocks);
}
