export const STATUS_LABELS = {
  reported: 'Reported',
  possible_match: 'Possible Match',
  claim_requested: 'Claim Requested',
  verification: 'Verification',
  returned: 'Returned',
  closed: 'Closed',
};

export const STATUS_FLOW = [
  'reported',
  'possible_match',
  'claim_requested',
  'verification',
  'returned',
  'closed',
];

export const CLAIM_STEPS = [
  { key: 'submitted', label: 'Claim Submitted' },
  { key: 'verification', label: 'Verification' },
  { key: 'review', label: 'Review' },
  { key: 'handover', label: 'Handover' },
  { key: 'returned', label: 'Returned' },
];

export function initials(name = '') {
  return String(name)
    .replace(/[^\w\s•]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || '?';
}

export function avatarStyle(hue = 265) {
  return {
    background: `linear-gradient(135deg, hsl(${hue} 72% 58%), hsl(${Number(hue) + 34} 68% 40%))`,
  };
}

export function formatDate(value, opts = {}) {
  if (!value) return '—';
  const d = new Date(value.length === 19 ? `${value.replace(' ', 'T')}Z` : value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: opts.year === false ? undefined : 'numeric',
  });
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value.length === 19 ? `${value.replace(' ', 'T')}Z` : value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(value) {
  if (!value) return '';
  const d = new Date(value.length === 19 ? `${value.replace(' ', 'T')}Z` : value);
  const diff = Date.now() - d.getTime();
  if (Number.isNaN(diff)) return '';
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

/** ISO string for <input type="datetime-local"> */
export function toLocalInput(date = new Date()) {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

export const compact = (n) =>
  new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);

export function scoreTone(score) {
  if (score >= 85) return 'strong';
  if (score >= 65) return 'good';
  return 'weak';
}
