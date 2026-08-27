/**
 * Hero artwork: a hooded guardian cradling a glowing orb of light.
 *
 * Drawn entirely in SVG — no image assets, so it scales crisply, themes with
 * the palette, and costs one network request less than a photograph.
 */
export default function GuardianOrb({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 520 580"
      role="img"
      aria-label="A hooded guardian figure cradling a glowing orb of light among the stars"
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      <defs>
        {/* Orb core */}
        <radialGradient id="orbCore" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="22%" stopColor="#f5f3ff" />
          <stop offset="52%" stopColor="#c4b5fd" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.9" />
        </radialGradient>

        {/* Halo around the orb */}
        <radialGradient id="orbHalo" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.85" />
          <stop offset="45%" stopColor="#8b5cf6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
        </radialGradient>

        {/* Nebula clouds behind the figure */}
        <radialGradient id="nebulaA" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#4c1d95" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="nebulaB" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#6d28d9" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#2e1065" stopOpacity="0" />
        </radialGradient>

        {/* Cloak: near-black with a violet rim light */}
        <linearGradient id="cloak" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#15121f" />
          <stop offset="48%" stopColor="#0b0a12" />
          <stop offset="100%" stopColor="#1c1530" />
        </linearGradient>
        <linearGradient id="rimLight" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.75" />
          <stop offset="45%" stopColor="#8b5cf6" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#c4b5fd" stopOpacity="0.6" />
        </linearGradient>

        <filter id="softGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <filter id="tightGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      {/* --- nebula backdrop --- */}
      <ellipse cx="300" cy="230" rx="240" ry="215" fill="url(#nebulaA)" />
      <ellipse cx="160" cy="330" rx="185" ry="200" fill="url(#nebulaB)" />

      {/* --- the cloak / hood silhouette ---
          Wide shoulders and a lower hood apex so the shape reads as a figure
          rather than a spire; the rim light sits just outside the body to give
          a backlit edge. */}
      <g>
        <path
          d="M34 580 C30 486 52 424 104 372 C118 268 176 176 260 164 C344 176 402 268 416 372 C468 424 490 486 486 580 Z"
          fill="url(#rimLight)"
          filter="url(#tightGlow)"
          opacity="0.95"
        />
        <path
          d="M48 580 C44 490 66 430 116 380 C130 280 184 190 260 180 C336 190 390 280 404 380 C454 430 476 490 472 580 Z"
          fill="url(#cloak)"
        />
        {/* hood opening: the void where a face would be */}
        <path
          d="M260 208 C300 208 320 244 320 282 C320 328 294 360 260 360 C226 360 200 328 200 282 C200 244 220 208 260 208 Z"
          fill="#05040a"
        />
        <ellipse cx="260" cy="292" rx="42" ry="52" fill="#0a0812" opacity="0.92" />
        {/* faint violet light from within the hood */}
        <ellipse cx="260" cy="304" rx="30" ry="40" fill="#7c3aed" opacity="0.3" filter="url(#tightGlow)" />

        {/* cloak folds catching the orb light */}
        <g stroke="#a78bfa" strokeOpacity="0.22" strokeWidth="1.6" fill="none" strokeLinecap="round">
          <path d="M150 580 C146 512 158 462 186 424" />
          <path d="M370 580 C374 512 362 462 334 424" />
          <path d="M108 580 C106 520 114 480 132 448" />
          <path d="M412 580 C414 520 406 480 388 448" />
          <path d="M214 214 C186 250 172 306 176 366" />
          <path d="M306 214 C334 250 348 306 344 366" />
        </g>
      </g>

      {/* --- cradling hands --- */}
      <g fill="#0b0a12" stroke="url(#rimLight)" strokeWidth="1.6">
        {/* left hand */}
        <g transform="rotate(-16 205 452)">
          <rect x="150" y="430" width="86" height="20" rx="10" />
          <rect x="158" y="406" width="74" height="17" rx="8.5" />
          <rect x="170" y="384" width="62" height="16" rx="8" />
          <path d="M150 448 C138 470 146 500 176 508 L228 508 L228 448 Z" />
        </g>
        {/* right hand */}
        <g transform="rotate(16 315 452)">
          <rect x="284" y="430" width="86" height="20" rx="10" />
          <rect x="288" y="406" width="74" height="17" rx="8.5" />
          <rect x="288" y="384" width="62" height="16" rx="8" />
          <path d="M370 448 C382 470 374 500 344 508 L292 508 L292 448 Z" />
        </g>
      </g>

      {/* --- the orb --- */}
      <g style={{ transformOrigin: '260px 372px' }}>
        <circle cx="260" cy="372" r="132" fill="url(#orbHalo)" filter="url(#softGlow)" />
        <circle cx="260" cy="372" r="66" fill="url(#orbHalo)" />
        <circle cx="260" cy="372" r="40" fill="url(#orbCore)" />
        <circle cx="260" cy="372" r="17" fill="#ffffff" opacity="0.95" filter="url(#tightGlow)" />
        {/* orbit rings, hinting at "searching" */}
        <ellipse
          cx="260"
          cy="372"
          rx="86"
          ry="30"
          fill="none"
          stroke="#c4b5fd"
          strokeWidth="1.1"
          opacity="0.5"
          transform="rotate(-18 260 372)"
        />
        <ellipse
          cx="260"
          cy="372"
          rx="112"
          ry="40"
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="1"
          opacity="0.32"
          transform="rotate(14 260 372)"
        />
      </g>

      {/* --- drifting motes of light --- */}
      <g fill="#e9e5ff">
        {[
          [126, 196, 2.4, 0],
          [402, 168, 1.9, 1.1],
          [96, 316, 1.6, 2.2],
          [428, 300, 2.1, 0.6],
          [172, 132, 1.4, 1.7],
          [352, 108, 1.7, 2.8],
          [66, 236, 1.3, 3.3],
          [452, 232, 1.5, 1.4],
        ].map(([cx, cy, r, delay]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} className="c-star" style={{ animationDelay: `${delay}s` }} />
        ))}
      </g>
    </svg>
  );
}
