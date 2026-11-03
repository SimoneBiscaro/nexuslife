import { h } from '../../vendor/preact.mjs';
import htm from '../../vendor/htm.mjs';

/** Template tag JSX-like per Preact, senza build step. */
export const html = htm.bind(h);
