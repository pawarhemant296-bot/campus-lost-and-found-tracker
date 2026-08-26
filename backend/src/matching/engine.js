/**
 * Smart Matching Engine - spec section 6.
 *
 *   Item / category similarity  25%
 *   Description similarity      25%
 *   Location similarity         20%
 *   Date / time proximity       15%
 *   Image similarity            15%
 *
 * Factors that cannot be evaluated (e.g. no images uploaded, AI service off)
 * are marked as skipped and their weight is redistributed over the remaining
 * factors, so a missing photo can never cap an otherwise perfect match.
 */
import config from '../config/env.js';
import { scorePairWithAi } from './aiClient.js';
import {
  categorySimilarity,
  clamp01,
  locationSimilarity,
  sharedKeywords,
  textSimilarity,
  timeProximity,
} from './similarity.js';

const pct = (value) => Math.round(clamp01(value) * 1000) / 10;

/**
 * Scores one lost/found pair.
 * @param {object} lostItem  item row with type 'lost'
 * @param {object} foundItem item row with type 'found'
 * @param {{ai?: {description:number|null,image:number|null,model:string}|null}} options
 */
export function scorePair(lostItem, foundItem, { ai = null } = {}) {
  const weights = config.matching.weights;

  // --- individual factors ---------------------------------------------------
  const category = categorySimilarity(lostItem, foundItem);

  const heuristicDescription = textSimilarity(
    `${lostItem.title} ${lostItem.description}`,
    `${foundItem.title} ${foundItem.description}`,
  );
  // Semantic model, when present, is blended with the lexical score.
  const description =
    ai?.description != null
      ? clamp01(0.6 * ai.description + 0.4 * heuristicDescription)
      : heuristicDescription;

  const location = locationSimilarity(lostItem, foundItem);
  const time = timeProximity(lostItem.occurred_at, foundItem.occurred_at, config.matching.dateWindowDays);

  const bothHaveImages = Boolean(lostItem.image_url && foundItem.image_url);
  const imageScore = ai?.image != null && bothHaveImages ? clamp01(ai.image) : null;

  const keywords = sharedKeywords(
    `${lostItem.title} ${lostItem.description}`,
    `${foundItem.title} ${foundItem.description}`,
  );

  const factors = [
    {
      key: 'category',
      label: 'Item / category similarity',
      weight: weights.category,
      score: category,
      reason:
        category >= 0.7
          ? `Same category: ${foundItem.category}`
          : `Different category (${lostItem.category} vs ${foundItem.category})`,
    },
    {
      key: 'description',
      label: 'Description similarity',
      weight: weights.description,
      score: description,
      reason: keywords.length
        ? `Shared details: ${keywords.join(', ')}`
        : 'Descriptions have little in common',
      source: ai?.description != null ? `ai:${ai.model}` : 'lexical',
    },
    {
      key: 'location',
      label: 'Location similarity',
      weight: weights.location,
      score: location.score,
      reason:
        location.distanceKm != null
          ? `${location.distanceKm.toFixed(2)} km apart`
          : location.score >= 0.5
            ? `Both near "${foundItem.location}"`
            : `Reported in different places`,
    },
    {
      key: 'time',
      label: 'Date / time proximity',
      weight: weights.time,
      score: time.score,
      reason:
        time.dayGap == null
          ? 'Dates unavailable'
          : time.dayGap < 1
            ? 'Reported on the same day'
            : `${time.dayGap} day(s) apart`,
    },
    {
      key: 'image',
      label: 'Image similarity',
      weight: weights.image,
      score: imageScore ?? 0,
      skipped: imageScore === null,
      reason: !bothHaveImages
        ? 'Skipped - both reports need a photo'
        : imageScore === null
          ? 'Skipped - AI image matching is disabled'
          : `Visual similarity ${pct(imageScore)}%`,
      source: imageScore != null ? `ai:${ai?.model}` : null,
    },
  ];

  // --- weighted combination with redistribution ------------------------------
  const active = factors.filter((factor) => !factor.skipped);
  const activeWeight = active.reduce((sum, factor) => sum + factor.weight, 0) || 1;

  let total = 0;
  for (const factor of factors) {
    const effectiveWeight = factor.skipped ? 0 : factor.weight / activeWeight;
    factor.effective_weight = Number(effectiveWeight.toFixed(4));
    factor.score_pct = pct(factor.score);
    factor.weight_pct = Math.round(factor.weight * 100);
    factor.contribution_pct = Number((effectiveWeight * clamp01(factor.score) * 100).toFixed(1));
    total += effectiveWeight * clamp01(factor.score);
  }

  const score = pct(total);

  return {
    score,
    strong: score >= config.matching.strongScore,
    factors,
    keywords,
    reasons: factors
      .filter((factor) => !factor.skipped && factor.score >= 0.5)
      .sort((a, b) => b.contribution_pct - a.contribution_pct)
      .map((factor) => factor.reason),
    ai_used: Boolean(ai),
    computed_at: new Date().toISOString(),
  };
}

/** Same as `scorePair` but consults the optional Python AI service first. */
export async function scorePairAsync(lostItem, foundItem) {
  const ai = await scorePairWithAi(lostItem, foundItem);
  return scorePair(lostItem, foundItem, { ai });
}

/**
 * Ranks every candidate against one item.
 * @returns {Promise<Array<{item:object,result:object}>>} sorted, best first
 */
export async function rankCandidates(item, candidates) {
  const isLost = item.type === 'lost';
  const scored = [];
  for (const candidate of candidates) {
    const lostItem = isLost ? item : candidate;
    const foundItem = isLost ? candidate : item;
    scored.push({ item: candidate, result: await scorePairAsync(lostItem, foundItem) });
  }
  return scored.sort((a, b) => b.result.score - a.result.score);
}

export const matchingWeights = () => ({ ...config.matching.weights });
