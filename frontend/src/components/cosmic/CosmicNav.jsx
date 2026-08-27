import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { ArrowRight, CompassIcon } from './CosmicIcons.jsx';

/**
 * Landing page navigation. Every entry points somewhere real: product routes go
 * through the router, the rest are in-page anchors.
 */
const LINKS = [
  { label: 'Home', to: '/', type: 'route', exact: true },
  { label: 'How It Works', to: '#how-it-works', type: 'anchor' },
  { label: 'Browse Items', to: '/search', type: 'route' },
  { label: 'Report Item', to: '/report/lost', type: 'route', requiresAuth: true },
  { label: 'Community', to: '#stories', type: 'anchor' },
  { label: 'Contact', to: '#contact', type: 'anchor' },
];

export function CosmicLogo({ compact = false }) {
  return (
    <Link to="/" className="c-logo" aria-label="FindIt — Lost and Found Network, home">
      <span className="c-logo-mark">
        <CompassIcon size={compact ? 20 : 23} style={{ color: '#fff' }} />
      </span>
      <span>
        <span className="c-logo-word">FindIt</span>
        <span className="c-logo-tag">Lost &amp; Found Network</span>
      </span>
    </Link>
  );
}

export default function CosmicNav() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  // Signed-out visitors are sent to register first, so the CTA never dead-ends.
  const reportHref = user ? '/report/lost' : '/register';

  return (
    <header className="c-nav">
      <div className="c-container c-nav-inner">
        <CosmicLogo />

        <nav className={`c-nav-links${open ? ' open' : ''}`} onClick={() => setOpen(false)}>
          {LINKS.map((link) =>
            link.type === 'anchor' ? (
              <a key={link.label} href={link.to}>
                {link.label}
              </a>
            ) : (
              <Link
                key={link.label}
                to={link.requiresAuth && !user ? '/register' : link.to}
                className={link.exact ? 'active' : undefined}
              >
                {link.label}
              </Link>
            ),
          )}
        </nav>

        <button
          type="button"
          className="c-nav-toggle"
          onClick={() => setOpen((value) => !value)}
          aria-label="Toggle navigation"
          aria-expanded={open}
        >
          ☰
        </button>

        <Link className="c-btn c-btn-primary c-btn-sm" to={reportHref}>
          Report Now <ArrowRight />
        </Link>
      </div>
    </header>
  );
}
