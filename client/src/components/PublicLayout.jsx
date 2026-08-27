import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Avatar, Button } from './ui.jsx';
import { useAuth } from '../lib/auth.jsx';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/browse', label: 'Browse Items' },
  { to: '/app/report/lost', label: 'Report' },
  { to: '/contact', label: 'Contact' },
];

export function Logo({ to = '/' }) {
  return (
    <Link to={to} className="logo" aria-label="TraceBack home">
      <span className="logo-mark">
        <span />
      </span>
      <span className="logo-word">TraceBack</span>
    </Link>
  );
}

export function Navbar() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Logo />
        <nav className="navlinks">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => `navlink ${isActive ? 'active' : ''}`}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="row gap-3">
          {user ? (
            <Link to="/app" className="row gap-3" style={{ color: 'inherit' }}>
              <span className="small muted hide-sm">{user.name.split(' ')[0]}</span>
              <Avatar name={user.name} hue={user.avatar_hue} size="sm" />
            </Link>
          ) : (
            <Link to="/login" className="navlink hide-sm">
              Sign in
            </Link>
          )}
          <Button to={user ? '/app' : '/register'} size="sm" iconRight="arrowRight" className="hide-sm">
            {user ? 'Dashboard' : 'Get Started'}
          </Button>
          <button
            className="hamburger"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle navigation"
            aria-expanded={open}
          >
            <Icon name={open ? 'x' : 'menu'} size={20} />
          </button>
        </div>
      </div>

      {open && (
        <div className="container" style={{ paddingBottom: 'var(--s-4)' }}>
          <div className="card card-pad-sm col gap-2">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) => `navlink ${isActive ? 'active' : ''}`}
                style={{ display: 'block' }}
              >
                {l.label}
              </NavLink>
            ))}
            <div className="divider" />
            <Button to={user ? '/app' : '/login'} block onClick={() => setOpen(false)} iconRight="arrowRight">
              {user ? 'Open Dashboard' : 'Sign in'}
            </Button>
            {!user && (
              <Button to="/register" variant="ghost" block onClick={() => setOpen(false)}>
                Create an account
              </Button>
            )}
          </div>
        </div>
      )}
      {pathname === '/' && <div className="divider" />}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <Logo />
            <p className="small mt-3" style={{ maxWidth: '34ch' }}>
              An AI-assisted lost &amp; found network for campuses and public spaces. Report it once —
              TraceBack keeps scanning until it finds a match.
            </p>
            <div className="row gap-2 mt-4">
              <span className="tag">
                <Icon name="shield" size={12} /> Privacy-first
              </span>
              <span className="tag">
                <Icon name="sparkle" size={12} /> Smart matching
              </span>
            </div>
          </div>
          <div>
            <h5>Product</h5>
            <ul>
              <li>
                <Link to="/browse">Browse items</Link>
              </li>
              <li>
                <Link to="/app/report/lost">Report a lost item</Link>
              </li>
              <li>
                <Link to="/app/report/found">Report a found item</Link>
              </li>
              <li>
                <Link to="/how-it-works">How it works</Link>
              </li>
            </ul>
          </div>
          <div>
            <h5>Account</h5>
            <ul>
              <li>
                <Link to="/login">Sign in</Link>
              </li>
              <li>
                <Link to="/register">Create account</Link>
              </li>
              <li>
                <Link to="/app">Dashboard</Link>
              </li>
              <li>
                <Link to="/app/matches">Possible matches</Link>
              </li>
            </ul>
          </div>
          <div>
            <h5>Stay in the loop</h5>
            <p className="small mb-4">Get notified when a match is found near you.</p>
            <form className="newsletter" onSubmit={(e) => e.preventDefault()}>
              <input className="input" type="email" placeholder="you@college.edu" aria-label="Email" />
              <Button type="submit" size="sm" aria-label="Subscribe">
                <Icon name="arrowRight" size={16} />
              </Button>
            </form>
            <ul className="mt-4">
              <li className="row gap-2 muted small">
                <Icon name="mail" size={13} /> help@traceback.app
              </li>
              <li className="row gap-2 muted small">
                <Icon name="building" size={13} /> Campus Security Office, Block C
              </li>
            </ul>
          </div>
        </div>
        <div className="divider" style={{ margin: 'var(--s-8) 0 var(--s-4)' }} />
        <div className="row-between row-wrap tiny faint">
          <span>© {new Date().getFullYear()} TraceBack · Lost &amp; Found Item Tracker</span>
          <span className="row gap-4">
            <Link to="/contact">Contact</Link>
            <span>Privacy</span>
            <span>Terms</span>
          </span>
        </div>
      </div>
    </footer>
  );
}

export default function PublicLayout() {
  return (
    <div className="shell">
      <Navbar />
      <Outlet />
      <Footer />
    </div>
  );
}
