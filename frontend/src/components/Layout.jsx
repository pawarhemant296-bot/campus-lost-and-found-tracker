import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';
import NotificationBell from './NotificationBell.jsx';

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

          <button type="button" className="nav-toggle" onClick={() => setMenuOpen((value) => !value)} aria-label="Menu">
            ☰
          </button>

          <nav className={`nav${menuOpen ? ' open' : ''}`} onClick={close}>
            <NavLink to="/search">Search</NavLink>
            {user ? (
              <>
                <NavLink to="/dashboard">Dashboard</NavLink>
                <NavLink to="/report/lost">Report lost</NavLink>
                <NavLink to="/report/found">Report found</NavLink>
                <NavLink to="/matches">Matches</NavLink>
                <NavLink to="/claims">Claims</NavLink>
                <NavLink to="/messages">Messages{unreadMessages > 0 ? ` (${unreadMessages})` : ''}</NavLink>
                <NavLink to="/my-reports">My reports</NavLink>
                {isAdmin && <NavLink to="/admin">Admin</NavLink>}
              </>
            ) : (
              <>
                <NavLink to="/login">Sign in</NavLink>
                <NavLink to="/register">Register</NavLink>
              </>
            )}
          </nav>

          <div className="spacer" />

          {user && (
            <div className="row" style={{ gap: 8 }}>
              <NotificationBell />
              <div className="small nowrap" title={user.email}>
                <strong>{user.name.split(' ')[0]}</strong>
                {isAdmin && <span className="badge badge-brand" style={{ marginLeft: 6 }}>admin</span>}
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="page">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="container row row-between">
          <span>Lost &amp; Found Item Tracker · PCE SW PS 13</span>
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
