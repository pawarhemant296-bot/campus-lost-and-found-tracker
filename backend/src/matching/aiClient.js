/**
 * Optional bridge to the Python AI service (spec section 10 / phase 9).
 *
 * The service refines two factors: semantic description similarity and image
 * similarity. It is strictly additive - when it is disabled, unreachable or
 * slow, the JavaScript engine keeps working with its own heuristics.
 */
import config from '../config/env.js';

let unhealthyUntil = 0;

const isCircuitOpen = () => Date.now() < unhealthyUntil;

/** Back off for 30s after a failure so requests do not pile up during a demo. */
const openCircuit = () => {
  unhealthyUntil = Date.now() + 30_000;
};

async function postJson(pathname, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs);
  try {
    const response = await fetch(`${config.ai.url}${pathname}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`AI service responded ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @returns {Promise<{description:number|null,image:number|null,model:string}|null>}
 *   null means "no AI input available - use heuristics only".
 */
export async function scorePairWithAi(lostItem, foundItem) {
  if (!config.ai.enabled || isCircuitOpen()) return null;
  try {
    const payload = {
      lost: {
        title: lostItem.title,
        description: lostItem.description,
        category: lostItem.category,
        image_url: lostItem.image_url ?? null,
      },
      found: {
        title: foundItem.title,
        description: foundItem.description,
        category: foundItem.category,
        image_url: foundItem.image_url ?? null,
      },
    };
    const data = await postJson('/similarity', payload);
    return {
      description: typeof data.description_similarity === 'number' ? data.description_similarity : null,
      image: typeof data.image_similarity === 'number' ? data.image_similarity : null,
      model: data.model ?? 'unknown',
    };
  } catch (error) {
    openCircuit();
    console.warn(`[ai] similarity unavailable (${error.message}); falling back to local matching`);
    return null;
  }
}

export async function aiHealth() {
  if (!config.ai.enabled) return { enabled: false, reachable: false };
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.ai.timeoutMs);
    const response = await fetch(`${config.ai.url}/health`, { signal: controller.signal });
    clearTimeout(timer);
    const body = await response.json().catch(() => ({}));
    return { enabled: true, reachable: response.ok, ...body };
  } catch (error) {
    return { enabled: true, reachable: false, error: error.message };
  }
}
