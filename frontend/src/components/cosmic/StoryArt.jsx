/**
 * Category artwork for the "Real Reunions" gallery.
 *
 * Each tile gets a distinct nebula wash plus a simple emblem, so the grid reads
 * as four different stories without needing four licensed photographs.
 */

const PALETTES = {
  pets: ['#7c3aed', '#c026d3', '#1b0f2e'],
  wallets: ['#6d28d9', '#8b5cf6', '#140e26'],
  electronics: ['#4f46e5', '#a78bfa', '#0f0d24'],
  travel: ['#9333ea', '#e879f9', '#1a0f26'],
};

function Emblem({ kind }) {
  const common = {
    fill: 'none',
    stroke: '#ede9fe',
    strokeWidth: 2.2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    opacity: 0.9,
  };

  if (kind === 'pets') {
    return (
      <g {...common}>
        <ellipse cx="50" cy="62" rx="15" ry="12" />
        <circle cx="31" cy="43" r="7" />
        <circle cx="45" cy="34" r="7" />
        <circle cx="60" cy="35" r="7" />
        <circle cx="72" cy="47" r="7" />
      </g>
    );
  }
  if (kind === 'wallets') {
    return (
      <g {...common}>
        <rect x="24" y="34" width="54" height="36" rx="7" />
        <path d="M24 45h54" />
        <circle cx="65" cy="57" r="4.5" />
      </g>
    );
  }
  if (kind === 'electronics') {
    return (
      <g {...common}>
        <rect x="34" y="26" width="34" height="52" rx="7" />
        <path d="M46 34h10" />
        <circle cx="51" cy="68" r="3.5" />
      </g>
    );
  }
  return (
    <g {...common}>
      <rect x="28" y="38" width="46" height="36" rx="6" />
      <path d="M42 38v-6a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v6M51 46v20" />
    </g>
  );
}

export default function StoryArt({ kind = 'pets' }) {
  const [from, to, base] = PALETTES[kind] ?? PALETTES.pets;
  const id = `story-${kind}`;

  return (
    <svg className="c-story-art" viewBox="0 0 100 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={base} />
          <stop offset="100%" stopColor="#07060c" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="38%">
          <stop offset="0%" stopColor={from} stopOpacity="0.85" />
          <stop offset="55%" stopColor={to} stopOpacity="0.25" />
          <stop offset="100%" stopColor={to} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="100" height="120" fill={`url(#${id}-bg)`} />
      <ellipse cx="50" cy="46" rx="48" ry="42" fill={`url(#${id}-glow)`} />

      {/* halo behind the emblem */}
      <circle cx="50" cy="50" r="30" fill="none" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="0.8" />
      <circle cx="50" cy="50" r="38" fill="none" stroke="#ffffff" strokeOpacity="0.07" strokeWidth="0.8" />

      <Emblem kind={kind} />

      {/* scattered stars */}
      <g fill="#ffffff">
        {[
          [14, 18, 0.9], [82, 24, 0.7], [26, 96, 0.8], [74, 104, 0.6], [90, 62, 0.7], [10, 60, 0.6],
        ].map(([cx, cy, r], index) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} opacity={0.5 + (index % 3) * 0.2} />
        ))}
      </g>
    </svg>
  );
}
