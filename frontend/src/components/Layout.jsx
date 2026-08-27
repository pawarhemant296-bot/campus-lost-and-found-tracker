import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import NotificationBell from './NotificationBell.jsx';
import ThemeToggle from './ThemeToggle.jsx';

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const { unreadMessages } = useNotifications();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const close = () => setMenuOpen(false);

  const handleLogout = () => {
    logout();
    close();
    navigate('/');
  };

  return (
    <div className="app-shell">
      <header className="header">
        <div className="container header-inner">
          <Link to={user ? '/dashboard' : '/'} className="brand" onClick={close}>
            <span className="brand-mark">🔍</span>
            <span className="nowrap">
              Lost &amp; Found<span className="muted small brand-suffix"> Tracker</span>
            </span>
          </Link>

          <button
            type="button"
            className="nav-toggle"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            ☰
          </button>

          {/* Browsing links only - reporting is the primary action button below. */}
          <nav className={`nav${menuOpen ? ' open' : ''}`} onClick={close}>
            <NavLink to="/search">Search</NavLink>
            {user ? (
              <>
                <NavLink to="/dashboard">Dashboard</NavLink>
                <NavLink to="/matches">Matches</NavLink>
                <NavLink to="/claims">Claims</NavLink>
                <NavLink to="/messages">Messages{unreadMessages > 0 ? ` (${unreadMessages})` : ''}</NavLink>
                <NavLink to="/my-reports">My reports</NavLink>
                {isAdmin && <NavLink to="/admin">Admin</NavLink>}
              </>
            ) : (
              <NavLink to="/login">Sign in</NavLink>
            )}
          </nav>

          <div className="spacer" />

          <div className="header-actions">
            <ThemeToggle />
            {user ? (
              <>
                <Link className="btn btn-sm" to="/report/lost" onClick={close}>
                  + Report item
                </Link>
                <NotificationBell />
                <span className="user-chip" title={user.email}>
                  <strong>{user.name.split(' ')[0]}</strong>
                  {isAdmin && <span className="badge badge-brand">admin</span>}
                </span>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
                  Sign out
                </button>
              </>
            ) : (
              <Link className="btn btn-sm" to="/register" onClick={close}>
                Get started
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="page">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="container row row-between">
          <span>Campus Lost &amp; Found Tracker</span>
          <span className="row" style={{ gap: 14 }}>
            <Link to="/search">Browse items</Link>
            <a href="/api/health" target="_blank" rel="noreferrer">
              API health
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
