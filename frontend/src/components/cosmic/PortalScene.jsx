/**
 * A lone figure walking toward a glowing ring in a dark landscape —
 * "the journey back to what you lost". Used in the About section (inside a
 * circular frame) and, in compact form, on the closing CTA banner.
 */
export default function PortalScene({ className = '', compact = false }) {
  return (
    <svg
      className={className}
      viewBox="0 0 600 600"
      role="img"
      aria-label="A figure walking toward a glowing violet portal in a dark landscape"
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <defs>
        <radialGradient id="portalSky" cx="50%" cy="42%">
          <stop offset="0%" stopColor="#3b1e78" />
          <stop offset="55%" stopColor="#17102b" />
          <stop offset="100%" stopColor="#08070e" />
        </radialGradient>
        <radialGradient id="portalGlow" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#c4b5fd" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#8b5cf6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ringStroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ddd6fe" />
          <stop offset="50%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a1330" />
          <stop offset="100%" stopColor="#07060c" />
        </linearGradient>
        <filter id="portalBlur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="12" />
        </filter>
      </defs>

      {/* On the CTA banner the scene sits on an existing gradient, so it stays
          transparent and only the light and silhouette are drawn. */}
      {!compact && <rect width="600" height="600" fill="url(#portalSky)" />}

      {/* stars */}
      <g fill="#ffffff">
        {[
          [70, 60, 1.6], [150, 110, 1.1], [250, 52, 1.4], [360, 96, 1.2], [470, 58, 1.7],
          [530, 140, 1.2], [100, 190, 1], [420, 180, 1.3], [560, 230, 1.1], [40, 260, 1.2],
          [200, 150, 0.9], [320, 130, 1], [480, 250, 0.9], [520, 80, 1],
        ].map(([cx, cy, r], index) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} opacity={0.5 + (index % 4) * 0.14} className="c-star" style={{ animationDelay: `${index * 0.3}s` }} />
        ))}
      </g>

      {/* the portal */}
      <g>
        <circle cx="300" cy="300" r="185" fill="url(#portalGlow)" filter="url(#portalBlur)" />
        <circle cx="300" cy="300" r="132" fill="none" stroke="url(#ringStroke)" strokeWidth="9" />
        <circle cx="300" cy="300" r="132" fill="none" stroke="#ede9fe" strokeWidth="2.5" opacity="0.85" />
        <circle cx="300" cy="300" r="118" fill="none" stroke="#8b5cf6" strokeWidth="1.4" opacity="0.45" />
      </g>

      {/* distant ridges */}
      {!compact && (
        <>
          <path d="M0 470 L120 402 L212 452 L300 396 L392 450 L486 398 L600 462 L600 600 L0 600 Z" fill="url(#ground)" />
          <path d="M0 512 L110 470 L230 508 L350 466 L470 506 L600 470 L600 600 L0 600 Z" fill="#05040a" opacity="0.92" />
        </>
      )}

      {/* light pooling on the ground beneath the portal */}
      <ellipse cx="300" cy="516" rx="150" ry="26" fill="#8b5cf6" opacity="0.3" filter="url(#portalBlur)" />

      {/* the walker, backlit */}
      {!compact && (
        <g fill="#05040a" stroke="#c4b5fd" strokeWidth="1.2" strokeOpacity="0.55">
          <circle cx="300" cy="416" r="15" />
          <path d="M286 434 C286 428 314 428 314 434 L320 486 L308 486 L304 456 L296 456 L292 486 L280 486 Z" />
          <path d="M288 442 L272 470 M312 442 L328 468" strokeWidth="5" strokeLinecap="round" stroke="#05040a" strokeOpacity="1" />
        </g>
      )}
      {compact && (
        <g fill="#05040a" stroke="#ddd6fe" strokeWidth="1.4" strokeOpacity="0.6">
          <circle cx="300" cy="404" r="19" />
          <path d="M282 426 C282 418 318 418 318 426 L326 500 L310 500 L305 460 L295 460 L290 500 L274 500 Z" />
        </g>
      )}
    </svg>
  );
}
