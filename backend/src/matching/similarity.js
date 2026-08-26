/**
 * Pure, dependency-free text/geo/time similarity helpers.
 * Every function returns a number in the range 0..1.
 */

const STOPWORDS = new Set([
  'a', 'an', 'the', 'my', 'me', 'i', 'is', 'was', 'were', 'am', 'are', 'be', 'been',
  'of', 'in', 'on', 'at', 'to', 'from', 'with', 'and', 'or', 'but', 'it', 'its',
  'this', 'that', 'these', 'those', 'for', 'by', 'near', 'around', 'about', 'some',
  'there', 'here', 'have', 'has', 'had', 'lost', 'found', 'item', 'items', 'please',
  'someone', 'somebody', 'anyone', 'kindly', 'help', 'if', 'while', 'when', 'today',
  'yesterday', 'morning', 'evening', 'afternoon', 'night',
]);

/** Words that strongly identify an object; worth extra weight when shared. */
const SALIENT_HINTS = new Set([
  'black', 'blue', 'red', 'green', 'white', 'brown', 'grey', 'gray', 'yellow', 'pink',
  'purple', 'orange', 'silver', 'golden', 'gold', 'leather', 'metal', 'plastic',
  'wallet', 'purse', 'phone', 'mobile', 'iphone', 'samsung', 'redmi', 'oneplus',
  'laptop', 'macbook', 'dell', 'hp', 'lenovo', 'charger', 'earphones', 'earbuds',
  'airpods', 'watch', 'ring', 'chain', 'bottle', 'bag', 'backpack', 'keys', 'keychain',
  'idcard', 'card', 'spectacles', 'glasses', 'umbrella', 'calculator', 'notebook',
]);

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Very small English stemmer: enough to match "keys"/"key", "wallets"/"wallet". */
function stem(token) {
  if (token.length > 4 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.length > 3 && token.endsWith('es')) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s')) return token.slice(0, -1);
  return token;
}

export function tokenize(value, { keepStopwords = false } = {}) {
  return normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 1)
    .filter((token) => keepStopwords || !STOPWORDS.has(token))
    .map(stem);
}

/** Character trigram set - catches typos and partial words. */
function trigrams(value) {
  const padded = ` ${normalizeText(value).replace(/\s+/g, ' ')} `;
  const set = new Set();
  for (let i = 0; i < padded.length - 2; i += 1) set.add(padded.slice(i, i + 3));
  return set;
}

function jaccard(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let shared = 0;
  for (const value of setA) if (setB.has(value)) shared += 1;
  return shared / (setA.size + setB.size - shared);
}

/** Trigram (fuzzy string) similarity - resilient to typos. */
export function trigramSimilarity(a, b) {
  return jaccard(trigrams(a), trigrams(b));
}

/**
 * Weighted token overlap. Two ideas make this work for lost/found text:
 *
 *  1. Colour / material / object words count double - "black leather wallet" is
 *     far more identifying than "left it there".
 *  2. Alongside the symmetric Dice score we use *containment* (overlap over the
 *     shorter text) and *salient coverage*, because the two people describe the
 *     same object at very different lengths: the owner lists what is inside, the
 *     finder only describes what is visible. Pure Dice punishes that unfairly.
 */
export function tokenSimilarity(a, b) {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  const weightOf = (token) => (SALIENT_HINTS.has(token) ? 2 : 1);
  const sum = (tokens) => [...tokens].reduce((total, token) => total + weightOf(token), 0);

  const totalA = sum(tokensA);
  const totalB = sum(tokensB);
  const shared = [...tokensA].filter((token) => tokensB.has(token));
  const sharedWeight = sum(shared);

  const dice = (2 * sharedWeight) / (totalA + totalB);
  const containment = sharedWeight / Math.max(Math.min(totalA, totalB), 1);

  // How many of the identifying words of the shorter description are matched?
  const salientA = [...tokensA].filter((token) => SALIENT_HINTS.has(token));
  const salientB = [...tokensB].filter((token) => SALIENT_HINTS.has(token));
  const salientShared = salientA.filter((token) => tokensB.has(token)).length;
  const salientDenominator = Math.min(salientA.length, salientB.length);
  const salientCoverage = salientDenominator === 0 ? 0 : salientShared / salientDenominator;

  return clamp01(0.4 * dice + 0.35 * containment + 0.25 * salientCoverage);
}

/** Blend of weighted token overlap and fuzzy trigram similarity. */
export function textSimilarity(a, b) {
  if (!a || !b) return 0;
  const token = tokenSimilarity(a, b);
  const trigram = trigramSimilarity(a, b);
  return clamp01(0.85 * token + 0.15 * trigram);
}

/** Tokens present in both strings, useful for human-readable match reasons. */
export function sharedKeywords(a, b, limit = 6) {
  const tokensB = new Set(tokenize(b));
  const seen = new Set();
  const result = [];
  for (const token of tokenize(a)) {
    if (tokensB.has(token) && !seen.has(token)) {
      seen.add(token);
      result.push(token);
      if (result.length >= limit) break;
    }
  }
  return result;
}

/** Distance in km between two coordinates (haversine). */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Location similarity from free text, upgraded to real distance when both
 * reports carry coordinates (map-based advanced feature).
 */
export function locationSimilarity(a, b) {
  const textScore = textSimilarity(a?.location, b?.location);
  const hasGeo =
    Number.isFinite(a?.latitude) && Number.isFinite(a?.longitude) &&
    Number.isFinite(b?.latitude) && Number.isFinite(b?.longitude);

  if (!hasGeo) return { score: textScore, distanceKm: null };

  const distanceKm = haversineKm(a.latitude, a.longitude, b.latitude, b.longitude);
  // 0 km -> 1.0, 2 km -> ~0.0 (campus scale)
  const geoScore = clamp01(1 - distanceKm / 2);
  return { score: clamp01(Math.max(textScore, geoScore)), distanceKm };
}

/**
 * Date/time proximity with a directional sanity check: an item cannot be found
 * long before it was lost, so that case is penalised.
 */
export function timeProximity(lostAt, foundAt, windowDays = 14) {
  const lost = new Date(lostAt).getTime();
  const found = new Date(foundAt).getTime();
  if (!Number.isFinite(lost) || !Number.isFinite(found)) return { score: 0, dayGap: null };

  const dayGap = Math.abs(found - lost) / 86_400_000;
  let score = clamp01(1 - dayGap / Math.max(windowDays, 1));

  // Found more than a day *before* the loss is chronologically implausible.
  const foundBeforeLostDays = (lost - found) / 86_400_000;
  if (foundBeforeLostDays > 1) score *= 0.4;

  return { score, dayGap: Number(dayGap.toFixed(2)) };
}

/** Category + title similarity: identical category is a strong signal. */
export function categorySimilarity(a, b) {
  const sameCategory = normalizeText(a?.category) === normalizeText(b?.category) && !!a?.category;
  const titleScore = textSimilarity(a?.title, b?.title);
  if (sameCategory) return clamp01(0.7 + 0.3 * titleScore);
  const categoryScore = textSimilarity(a?.category, b?.category);
  return clamp01(0.55 * titleScore + 0.45 * categoryScore);
}

export function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
