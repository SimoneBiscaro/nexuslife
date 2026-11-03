/** Colori disponibili per le categorie: nome salvato nel record → variabile CSS. */
export const CATEGORY_COLORS = {
  mint: 'var(--mint)',
  champagne: 'var(--champagne)',
  'electric-blue': 'var(--electric-blue-glow)',
  health: 'var(--health)',
  amber: 'var(--amber)',
  'alarm-red': 'var(--alarm-red)',
  titanium: 'var(--titanium-light)',
};

export const CATEGORY_ICONS = ['leaf', 'jar', 'bottle', 'spray', 'box', 'paw', 'gift', 'baby', 'casa', 'salute', 'sparkle', 'bolt'];

export const colorVar = (name) => CATEGORY_COLORS[name] || CATEGORY_COLORS.titanium;
export const iconName = (name) => (CATEGORY_ICONS.includes(name) ? name : 'box');
