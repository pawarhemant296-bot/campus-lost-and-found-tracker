/**
 * TraceBack — Smart Matching Engine
 * ---------------------------------------------------------------------------
 * Compares a LOST report against a FOUND report (or vice-versa) and produces a
 * weighted similarity score, exactly as specified in the problem statement:
 *
 *   item / category similarity ....... 25%
 *   description similarity ........... 25%
 *   location similarity .............. 20%
 *   date / time proximity ............ 15%
 *   image similarity ................. 15%   (perceptual dHash, optional)
 *
 * The engine never relies on an exact title match: it uses token overlap,
 * character-bigram cosine similarity, a synonym/colour lexicon, geo-token
 * matching for locations and an exponential decay for time proximity.
 * Factors with no available data (e.g. no photo on either side) are dropped and
 * the remaining weights are re-normalised so scores stay comparable.
 */

const STOPWORDS = new Set([
  'a', 'an', 'the', 'my', 'mine', 'i', 'it', 'its', 'is', 'was', 'were', 'be', 'been',
  'of', 'in', 'on', 'at', 'to', 'from', 'with', 'and', 'or', 'but', 'for', 'near',
  'by', 'this', 'that', 'these', 'those', 'has', 'have', 'had', 'lost', 'found',
  'missing', 'somewhere', 'around', 'about', 'very', 'really', 'please', 'help',
  'item', 'items', 'thing', 'things', 'someone', 'anyone', 'if', 'you', 'your',
]);

/** Loose synonym clusters so "cell" ≈ "mobile" ≈ "phone", "purse" ≈ "wallet", … */
const SYNONYMS = [
  ['phone', 'mobile', 'cell', 'cellphone', 'smartphone', 'iphone', 'android', 'handset'],
  ['wallet', 'purse', 'billfold', 'cardholder'],
  ['laptop', 'notebook', 'macbook', 'chromebook', 'ultrabook'],
  ['bag', 'backpack', 'rucksack', 'satchel', 'haversack', 'sack'],
  ['bottle', 'flask', 'sipper', 'tumbler', 'thermos'],
  ['spectacles', 'glasses', 'specs', 'eyeglasses', 'goggles', 'sunglasses'],
  ['earphones', 'earbuds', 'headphones', 'airpods', 'buds', 'headset'],
  ['charger', 'adapter', 'adaptor', 'powerbank', 'cable', 'cord'],
  ['id', 'idcard', 'identity', 'badge', 'card'],
  ['keys', 'key', 'keychain', 'keyring', 'fob'],
  ['watch', 'wristwatch', 'smartwatch', 'fitband', 'fitbit'],
  ['umbrella', 'parasol'],
  ['calculator', 'casio'],
  ['file', 'folder', 'binder', 'documents', 'papers'],
  ['book', 'textbook', 'notes', 'notebook', 'diary', 'register'],
  ['black', 'dark', 'charcoal', 'jet'],
  ['blue', 'navy', 'azure', 'cobalt'],
  ['grey', 'gray', 'silver', 'ash'],
  ['red', 'maroon', 'crimson', 'scarlet'],
  ['canteen', 'cafeteria', 'mess', 'foodcourt', 'cafe'],
  ['library', 'reading', 'lib'],
  ['lab', 'laboratory'],
  ['ground', 'field', 'playground', 'court', 'stadium'],
  ['auditorium', 'seminar', 'hall'],
  ['hostel', 'dorm', 'dormitory'],
  ['parking', 'carpark', 'garage', 'lot'],
  ['bus', 'shuttle', 'stop', 'depot'],
  ['gate', 'entrance', 'entry', 'exit'],
];

const SYNONYM_MAP = (() => {
  const map = new Map();
  SYNONYMS.forEach((group, i) => group.forEach((w) => map.set(w, `g${i}`)));
  return map;
})();

/* ------------------------------------------------------------------ helpers */

export function normalise(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[_\-/]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(text = '', { keepStopwords = false } = {}) {
  return normalise(text)
    .split(' ')
    .filter((t) => t.length > 1 && (keepStopwords || !STOPWORDS.has(t)));
}

/** Map tokens through the synonym lexicon + a crude singular stemmer. */
function canonicalTokens(text, opts) {
  return tokenize(text, opts).map((t) => {
    const stem = t.length > 4 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t;
    return SYNONYM_MAP.get(t) || SYNONYM_MAP.get(stem) || stem;
  });
}

function jaccard(aSet, bSet) {
  if (!aSet.size || !bSet.size) return 0;
  let inter = 0;
  for (const v of aSet) if (bSet.has(v)) inter += 1;
  return inter / (aSet.size + bSet.size - inter);
}

/** Overlap coefficient — forgiving when one description is much longer. */
function overlap(aSet, bSet) {
  if (!aSet.size || !bSet.size) return 0;
  let inter = 0;
  for (const v of aSet) if (bSet.has(v)) inter += 1;
  return inter / Math.min(aSet.size, bSet.size);
}

function bigrams(text) {
  const s = normalise(text).replace(/\s/g, '');
  const out = new Map();
  for (let i = 0; i < s.length - 1; i += 1) {
    const g = s.slice(i, i + 2);
    out.set(g, (out.get(g) || 0) + 1);
  }
  return out;
}

/** Cosine similarity over character bigrams — catches typos & word variants. */
function bigramCosine(a, b) {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (const [, v] of A) magA += v * v;
  for (const [g, v] of B) {
    magB += v * v;
    if (A.has(g)) dot += v * A.get(g);
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
}

const clamp01 = (n) => Math.max(0, Math.min(1, n));

/**
 * Calibration curve for free-text similarity.
 * Two independently written descriptions of the *same* object typically share
 * only 30-45% of their distinctive tokens (people describe things differently),
 * while unrelated texts sit below 10%. This piecewise-linear curve maps that raw
 * lexical overlap onto a human-meaningful confidence value so a 0.40 overlap
 * reads as a strong signal instead of a weak one.
 */
function calibrate(raw) {
  const points = [
    [0, 0],
    [0.08, 0.08],
    [0.18, 0.32],
    [0.3, 0.6],
    [0.45, 0.82],
    [0.6, 0.93],
    [1, 1],
  ];
  for (let i = 1; i < points.length; i += 1) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (raw <= x1) return y0 + ((raw - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 1;
}

/* ------------------------------------------------------------------ factors */

/** 25% — item / category similarity (category equality + title similarity). */
export function categoryScore(a, b) {
  const sameCategory =
    normalise(a.category) && normalise(a.category) === normalise(b.category) ? 1 : 0;
  const aT = new Set(canonicalTokens(a.title));
  const bT = new Set(canonicalTokens(b.title));
  const titleSim = clamp01(0.65 * overlap(aT, bT) + 0.35 * bigramCosine(a.title, b.title));
  // Related-but-different categories still earn partial credit via the title.
  return clamp01(0.55 * sameCategory + 0.45 * titleSim);
}

/** 25% — free-text description similarity. */
export function descriptionScore(a, b) {
  const aText = `${a.title} ${a.description}`;
  const bText = `${b.title} ${b.description}`;
  const aT = new Set(canonicalTokens(aText));
  const bT = new Set(canonicalTokens(bText));
  const raw = 0.6 * overlap(aT, bT) + 0.15 * jaccard(aT, bT) + 0.25 * bigramCosine(aText, bText);
  return clamp01(calibrate(raw));
}

/** 20% — location similarity (token overlap + fuzzy string similarity). */
export function locationScore(a, b) {
  if (!normalise(a.location) || !normalise(b.location)) return 0;
  const aT = new Set(canonicalTokens(a.location, { keepStopwords: true }));
  const bT = new Set(canonicalTokens(b.location, { keepStopwords: true }));
  const exact = normalise(a.location) === normalise(b.location) ? 1 : 0;
  return clamp01(Math.max(exact, 0.7 * overlap(aT, bT) + 0.3 * bigramCosine(a.location, b.location)));
}

/** 15% — date/time proximity, linear-exponential decay across the window. */
export function dateScore(a, b, windowDays = 14) {
  const ta = Date.parse(a.item_date);
  const tb = Date.parse(b.item_date);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
  const diffDays = Math.abs(ta - tb) / 86_400_000;
  if (diffDays <= 0.25) return 1;                       // within 6 hours
  if (diffDays >= windowDays) return 0;
  return clamp01(Math.exp(-diffDays / (windowDays / 2.2)));
}

/** 15% — perceptual image similarity from 64-bit dHash Hamming distance. */
export function imageScore(a, b) {
  if (!a.image_hash || !b.image_hash) return null;      // factor unavailable
  const ha = BigInt(`0x${a.image_hash}`);
  const hb = BigInt(`0x${b.image_hash}`);
  let x = ha ^ hb;
  let bits = 0;
  while (x) {
    bits += Number(x & 1n);
    x >>= 1n;
  }
  const similarity = 1 - bits / 64;
  // Random images sit around 0.5, so stretch 0.5→1 into 0→1 for signal.
  return clamp01((similarity - 0.5) / 0.5);
}

/* -------------------------------------------------------------------- score */

export const FACTOR_LABELS = {
  category: 'Category & item name',
  description: 'Description similarity',
  location: 'Location proximity',
  date: 'Date & time proximity',
  image: 'Image similarity',
};

/**
 * @returns {{score:number, factors:Array, reasons:string[]}} score is 0-100.
 */
export function scoreItems(a, b, settings = {}) {
  const w = {
    category: settings.weight_category ?? 25,
    description: settings.weight_description ?? 25,
    location: settings.weight_location ?? 20,
    date: settings.weight_date ?? 15,
    image: settings.weight_image ?? 15,
  };
  const windowDays = settings.date_window_days ?? 14;

  const raw = {
    category: categoryScore(a, b),
    description: descriptionScore(a, b),
    location: locationScore(a, b),
    date: dateScore(a, b, windowDays),
    image: imageScore(a, b),
  };

  // Drop unavailable factors and re-normalise the remaining weights.
  const active = Object.keys(raw).filter((k) => raw[k] !== null);
  const totalWeight = active.reduce((s, k) => s + w[k], 0) || 1;

  let score = 0;
  const factors = Object.keys(raw).map((key) => {
    const available = raw[key] !== null;
    const value = available ? raw[key] : 0;
    const weight = w[key];
    const effectiveWeight = available ? (weight / totalWeight) * 100 : 0;
    const contribution = value * effectiveWeight;
    if (available) score += contribution;
    return {
      key,
      label: FACTOR_LABELS[key],
      value: Math.round(value * 100),
      weight,
      effectiveWeight: Math.round(effectiveWeight * 10) / 10,
      contribution: Math.round(contribution * 10) / 10,
      available,
    };
  });

  const reasons = [];
  if (raw.category >= 0.6) reasons.push('Same category and a closely matching item name');
  if (raw.description >= 0.5) reasons.push('Descriptions share distinctive details');
  if (raw.location >= 0.6) reasons.push('Reported at the same or a neighbouring location');
  if (raw.date >= 0.6) reasons.push('Lost and found within a short time window');
  if (raw.image !== null && raw.image >= 0.5) reasons.push('Photos are visually similar');
  if (!reasons.length) reasons.push('Weak signal — review the details manually');

  return { score: Math.round(score * 10) / 10, factors, reasons };
}

/**
 * Compare one item against every opposite-type candidate.
 * @returns candidates sorted by score, above the configured threshold.
 */
export function findMatches(item, candidates, settings = {}) {
  const threshold = settings.match_threshold ?? 45;
  return candidates
    .map((candidate) => {
      const { score, factors, reasons } = scoreItems(item, candidate, settings);
      return { candidate, score, factors, reasons };
    })
    .filter((m) => m.score >= threshold)
    .sort((x, y) => y.score - x.score);
}

/**
 * Verification answer scoring — compares a claimant's answers against the
 * private answers stored by the reporter (never exposed through the API).
 */
export function scoreAnswers(questions = [], answers = []) {
  if (!questions.length) return null;
  let total = 0;
  const detail = questions.map((q, i) => {
    const expected = String(q.a ?? '');
    const given = String(answers[i] ?? '');
    const eT = new Set(canonicalTokens(expected, { keepStopwords: true }));
    const gT = new Set(canonicalTokens(given, { keepStopwords: true }));
    const sim = clamp01(0.6 * overlap(eT, gT) + 0.4 * bigramCosine(expected, given));
    total += sim;
    return { question: q.q, similarity: Math.round(sim * 100), answered: given.length > 0 };
  });
  return { score: Math.round((total / questions.length) * 1000) / 10, detail };
}
