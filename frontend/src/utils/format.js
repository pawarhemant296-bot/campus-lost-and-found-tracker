/** Display helpers shared by every screen. */

export const CATEGORY_ICONS = {
  'Wallet / Purse': '👛',
  'Mobile Phone': '📱',
  'Laptop / Tablet': '💻',
  'ID Card / Documents': '🪪',
  Keys: '🔑',
  'Bag / Backpack': '🎒',
  'Books / Stationery': '📚',
  Clothing: '👕',
  'Jewellery / Watch': '⌚',
  'Earphones / Accessories': '🎧',
  'Water Bottle': '🧴',
  'Sports Equipment': '🏀',
  Other: '📦',
};

export const categoryIcon = (category) => CATEGORY_ICONS[category] ?? '📦';

export function formatDate(value, { withTime = true } = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export function relativeTime(value) {
  if (!value) return '';
  const diff = Date.now() - new Date(value).getTime();
  if (Number.isNaN(diff)) return '';
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value, { withTime: false });
}

/** Turns REPORTED / CLAIM_REQUESTED into "Reported" / "Claim requested". */
export const humanStatus = (status) =>
  String(status ?? '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^./, (char) => char.toUpperCase());

export const statusTone = (status) =>
  ({
    REPORTED: 'badge',
    POSSIBLE_MATCH: 'badge badge-brand',
    CLAIM_REQUESTED: 'badge badge-warn',
    VERIFICATION: 'badge badge-warn',
    RETURNED: 'badge badge-success',
    CLOSED: 'badge badge-success',
    PENDING: 'badge badge-warn',
    UNDER_REVIEW: 'badge badge-info',
    APPROVED: 'badge badge-success',
    REJECTED: 'badge badge-danger',
    HANDOVER_CONFIRMED: 'badge badge-success',
    POSSIBLE: 'badge badge-brand',
    CONFIRMED: 'badge badge-success',
  })[status] ?? 'badge';

/** Colour for a match score ring. */
export function scoreColor(score) {
  if (score >= 75) return '#059669';
  if (score >= 60) return '#d97706';
  return '#64748b';
}

export const scoreLabel = (score) => {
  if (score >= 90) return 'Almost certain';
  if (score >= 75) return 'Strong match';
  if (score >= 60) return 'Likely match';
  return 'Weak match';
};

/** `datetime-local` value for an input, defaulting to now. */
export function toDateTimeLocal(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
