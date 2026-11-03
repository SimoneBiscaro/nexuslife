import { toDateKey } from './dates.js';

/** Categorie spesa predefinite (D6). */
export const DEFAULT_CATEGORIES = [
  { name: 'Freschi', normName: 'freschi', icon: 'leaf', color: 'mint', builtin: true, order: 0 },
  { name: 'Dispensa', normName: 'dispensa', icon: 'jar', color: 'champagne', builtin: true, order: 1 },
  { name: 'Bevande', normName: 'bevande', icon: 'bottle', color: 'electric-blue', builtin: true, order: 2 },
  { name: 'Cura Casa', normName: 'cura casa', icon: 'spray', color: 'health', builtin: true, order: 3 },
  { name: 'Altro', normName: 'altro', icon: 'box', color: 'titanium', builtin: true, order: 4 },
];

export const URGENCY_RANK = { scorta: 0, normale: 1, urgente: 2 };

/** Minuscolo, trim, spazi singoli, senza accenti. I plurali restano come sono. */
export function normalizeName(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const QTY_RE = /^(?:[x×](\d{1,3})|(\d{1,3})[x×])$/i;

/**
 * Aggiunta rapida: "latte x2!" → { name: 'latte', quantity: 2, urgency: 'urgente' };
 * "*" finale → scorta; "x3" o "3x" → quantità. null se il nome è vuoto.
 */
export function parseQuickAdd(input) {
  let text = String(input ?? '').trim();
  let urgency = 'normale';
  for (;;) {
    const last = text.slice(-1);
    if (last === '!') { urgency = 'urgente'; text = text.slice(0, -1).trimEnd(); continue; }
    if (last === '*') { if (urgency !== 'urgente') urgency = 'scorta'; text = text.slice(0, -1).trimEnd(); continue; }
    break;
  }
  let quantity = 1;
  const words = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const m = QTY_RE.exec(word);
    if (m && quantity === 1) quantity = Math.max(1, Number(m[1] ?? m[2]));
    else words.push(word);
  }
  const name = words.join(' ').trim();
  if (!name) return null;
  return { name, normName: normalizeName(name), quantity, urgency };
}

/*
 * Dizionario italiano parola chiave → categoria predefinita (normName).
 * Le chiavi sono già normalizzate; quelle composte vincono sulle singole parole.
 */
const KEYWORDS = {
  freschi: [
    'latte', 'yogurt', 'burro', 'panna', 'formaggio', 'formaggi', 'mozzarella', 'parmigiano', 'grana', 'ricotta',
    'stracchino', 'mascarpone', 'uova', 'uovo', 'prosciutto', 'prosciutto cotto', 'prosciutto crudo', 'salame',
    'mortadella', 'bresaola', 'speck', 'affettati', 'pollo', 'petto di pollo', 'tacchino', 'manzo', 'maiale',
    'vitello', 'carne', 'macinato', 'salsiccia', 'salsicce', 'wurstel', 'hamburger', 'pesce', 'salmone',
    'merluzzo', 'gamberi', 'insalata', 'lattuga', 'rucola', 'pomodori', 'pomodoro', 'pomodorini', 'zucchine',
    'zucchina', 'carote', 'carota', 'patate', 'patata', 'cipolle', 'cipolla', 'aglio', 'peperoni', 'melanzane',
    'spinaci', 'broccoli', 'cavolfiore', 'finocchi', 'sedano', 'funghi', 'verdura', 'frutta', 'mele', 'mela',
    'banane', 'banana', 'arance', 'arancia', 'limoni', 'limone', 'fragole', 'pere', 'pera', 'uva', 'kiwi',
    'pesche', 'albicocche', 'mandarini', 'avocado', 'basilico', 'prezzemolo', 'pane', 'piadine', 'gnocchi',
    'pasta fresca', 'tortellini', 'ravioli',
  ],
  dispensa: [
    'pasta', 'spaghetti', 'penne', 'fusilli', 'rigatoni', 'riso', 'farina', 'zucchero', 'sale', 'olio',
    'olio di oliva', 'aceto', 'caffe', 'cialde', 'capsule', 'biscotti', 'cereali', 'fette biscottate',
    'marmellata', 'confettura', 'nutella', 'miele', 'legumi', 'ceci', 'fagioli', 'lenticchie', 'piselli',
    'passata', 'passata di pomodoro', 'pomodori pelati', 'pelati', 'tonno', 'sgombro', 'sugo', 'pesto',
    'crackers', 'grissini', 'taralli', 'cioccolato', 'lievito', 'brodo', 'dado', 'spezie', 'pepe', 'origano',
    'maionese', 'ketchup', 'senape', 'merendine', 'patatine', 'olive', 'mais', 'tisana', 'tisane', 'camomilla',
    'cacao', 'pangrattato', 'surgelati', 'piselli surgelati', 'gelato', 'pizza surgelata', 'frutta secca',
    'mandorle', 'noci',
  ],
  bevande: [
    'acqua', 'acqua frizzante', 'acqua naturale', 'vino', 'vino rosso', 'vino bianco', 'birra', 'birre',
    'succo', 'succhi', 'succo di frutta', 'spremuta', 'aranciata', 'coca cola', 'cola', 'chinotto', 'gassosa',
    'te freddo', 'the freddo', 'bibite', 'bibita', 'spumante', 'prosecco', 'sciroppo', 'energy drink', 'gin',
    'vodka', 'rum', 'whisky', 'amaro', 'aperol', 'tonica', 'latte di mandorla', 'latte di soia', 'bevanda vegetale',
  ],
  'cura casa': [
    'detersivo', 'detersivi', 'detersivo piatti', 'sapone', 'sapone mani', 'shampoo', 'balsamo', 'bagnoschiuma',
    'docciaschiuma', 'dentifricio', 'spazzolino', 'spazzolini', 'collutorio', 'filo interdentale',
    'carta igienica', 'scottex', 'carta cucina', 'tovaglioli', 'fazzoletti', 'sacchetti', 'sacchi', 'sacchi spazzatura',
    'spugne', 'spugna', 'candeggina', 'ammorbidente', 'anticalcare', 'sgrassatore', 'pastiglie lavastoviglie',
    'brillantante', 'deodorante', 'rasoi', 'rasoio', 'schiuma da barba', 'cotton fioc', 'dischetti', 'assorbenti',
    'pellicola', 'alluminio', 'carta forno', 'guanti', 'panni', 'mocio', 'lavatrice', 'crema', 'crema mani',
    'salviette', 'lettiera',
  ],
  altro: [
    'pile', 'batterie', 'lampadina', 'lampadine', 'crocchette', 'cibo gatto', 'cibo cane', 'scatolette',
    'cerotti', 'farmaci', 'fiori', 'candele', 'quaderno', 'penne biro', 'regalo',
  ],
};

const KEYWORD_INDEX = (() => {
  const map = new Map();
  for (const [cat, words] of Object.entries(KEYWORDS)) for (const w of words) if (!map.has(w)) map.set(w, cat);
  return map;
})();

/** Numero di parole chiave del dizionario (per i test: almeno 80). */
export const KEYWORD_COUNT = KEYWORD_INDEX.size;

/**
 * Categoria predefinita (normName) dal dizionario, o null.
 * Vince la chiave più lunga presente come parola intera; a parità, quella che compare prima.
 */
export function keywordCategory(normName) {
  const text = ` ${normalizeName(normName)} `;
  let best = null;
  for (const [kw, cat] of KEYWORD_INDEX) {
    const pos = text.indexOf(` ${kw} `);
    if (pos === -1) continue;
    if (!best || kw.length > best.kw.length || (kw.length === best.kw.length && pos < best.pos)) best = { kw, cat, pos };
  }
  return best?.cat ?? null;
}

/**
 * Categoria proposta: ultima usata per quel normName → dizionario → Dispensa.
 * @param {string} normName
 * @param {{ categories: Array<{id:string, normName:string, deleted?:boolean}>,
 *   history?: Array<{ normName: string, categoryId: string, date?: string, addedAt?: string, updatedAt?: string, deleted?: boolean }> }} ctx
 *   history: acquisti e articoli passati
 * @returns {string|null} id della categoria
 */
export function suggestCategory(normName, { categories, history = [] }) {
  const live = categories.filter((c) => !c.deleted);
  const byId = new Map(live.map((c) => [c.id, c]));
  const byNorm = new Map(live.map((c) => [c.normName, c]));
  const when = (h) => h.date || h.addedAt || h.updatedAt || '';
  const last = history
    .filter((h) => !h.deleted && h.normName === normName && byId.has(h.categoryId))
    .sort((a, b) => (when(a) < when(b) ? 1 : when(a) > when(b) ? -1 : 0))[0];
  if (last) return last.categoryId;
  const kw = keywordCategory(normName);
  return (kw && byNorm.get(kw)?.id) || byNorm.get('dispensa')?.id || byNorm.get('altro')?.id || live[0]?.id || null;
}

const URGENT_OLD_MS = 2 * 24 * 3600 * 1000;
/**
 * Bagliore di un articolo: urgente → 'warning' (ambra), urgente da più di 2 giorni → 'critical' (rosso).
 * @returns {'warning'|'critical'|null}
 */
export function urgencyGlow(item, now) {
  if (item.urgency !== 'urgente') return null;
  const age = new Date(now).getTime() - Date.parse(item.addedAt);
  return age > URGENT_OLD_MS ? 'critical' : 'warning';
}

const isOpen = (i) => !i.deleted && !i.archived;

/** Articoli in lista (non archiviati): spuntati in fondo, poi per urgenza e data. */
export function sortOpenItems(items) {
  return items.filter(isOpen).sort((a, b) =>
    (a.checkedAt ? 1 : 0) - (b.checkedAt ? 1 : 0)
    || URGENCY_RANK[b.urgency] - URGENCY_RANK[a.urgency]
    || (a.addedAt < b.addedAt ? -1 : a.addedAt > b.addedAt ? 1 : 0));
}

/**
 * "Concludi spesa": crea un groceryPurchase per ogni articolo spuntato e lo archivia.
 * @returns {{ purchases: Array<object>, archive: Array<{ id: string, archived: true }> }}
 */
export function concludeShopping(items, now) {
  const date = toDateKey(now);
  const checked = items.filter((i) => isOpen(i) && i.checkedAt);
  return {
    purchases: checked.map((i) => ({ normName: i.normName, name: i.name, date, categoryId: i.categoryId })),
    archive: checked.map((i) => ({ id: i.id, archived: true })),
  };
}

const AUTO_ARCHIVE_MS = 6 * 3600 * 1000;
/** All'avvio: gli articoli spuntati da più di 6 ore vanno archiviati (e registrati come acquisti). */
export function itemsToAutoArchive(items, now) {
  const nowMs = new Date(now).getTime();
  return items.filter((i) => isOpen(i) && i.checkedAt && nowMs - Date.parse(i.checkedAt) > AUTO_ARCHIVE_MS);
}

/** Categoria eliminata: i suoi articoli (e acquisti) passano in Altro. Restituisce le modifiche. */
export function reassignDeletedCategory(records, deletedCategoryId, altroId) {
  return records
    .filter((r) => !r.deleted && r.categoryId === deletedCategoryId)
    .map((r) => ({ id: r.id, entity: r.entity, categoryId: altroId }));
}

/** Articolo già in lista (aperto) con lo stesso nome normalizzato. */
export function findOpenItem(items, normName) {
  return items.find((i) => isOpen(i) && i.normName === normName) || null;
}
