import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Avatar, Button } from './ui.jsx';
import NotificationsPanel from './NotificationsPanel.jsx';
import { Logo } from './PublicLayout.jsx';
import { useAuth } from '../lib/auth.jsx';
import { NotificationsAPI } from '../lib/api.js';

const USER_NAV = [
  { section: 'Overview' },
  { to: '/app', label: 'Dashboard', icon: 'home', end: true },
  { to: '/app/report/lost', label: 'Report Lost', icon: 'search' },
  { to: '/app/report/found', label: 'Report Found', icon: 'box' },
  { section: 'Tracking' },
  { to: '/app/reports', label: 'My Reports', icon: 'list' },
  { to: '/app/matches', label: 'Possible Matches', icon: 'target', badge: 'matches' },
  { to: '/app/claims', label: 'Claims', icon: 'shield', badge: 'claims' },
  { section: 'Account' },
  { to: '/app/messages', label: 'Messages', icon: 'message', badge: 'messages' },
  { to: '/app/notifications', label: 'Notifications', icon: 'bell', badge: 'unread' },
  { to: '/app/profile', label: 'Profile', icon: 'user' },
];

const ADMIN_NAV = [
  { section: 'Moderation' },
  { to: '/admin', label: 'Overview', icon: 'chart', end: true },
  { to: '/admin/users', label: 'Manage Users', icon: 'users' },
  { to: '/admin/items', label: 'Manage Items', icon: 'box' },
  { to: '/admin/claims', label: 'Manage Claims', icon: 'shield' },
  { to: '/admin/disputes', label: 'Disputes', icon: 'scale', badge: 'disputes' },
  { section: 'Insights' },
  { to: '/admin/analytics', label: 'Analytics', icon: 'pie' },
  { to: '/admin/settings', label: 'Settings', icon: 'sliders' },
  { section: 'User side' },
  { to: '/app', label: 'My Dashboard', icon: 'home' },
];

export default function AppLayout({ variant = 'user' }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [counts, setCounts] = useState({ unread: 0, messages: 0 });
  const [panelOpen, setPanelOpen] = useState(false);
  const [search, setSearch] = useState('');

  const refresh = useCallback(async () => {
    try {
      const data = await NotificationsAPI.list();
      setNotifications(data.notifications || []);
      setCounts({ unread: data.unread || 0, messages: data.unread_messages || 0 });
    } catch {
      /* offline / expired token — the route guard will handle it */
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15000);
    return () => clearInterval(t);
  }, [refresh]);

  const nav = variant === 'admin' ? ADMIN_NAV : USER_NAV;
  const badgeValue = (key) => {
    if (key === 'unread') return counts.unread;
    if (key === 'messages') return counts.messages;
    return 0;
  };

  const submitSearch = (e) => {
    e.preventDefault();
    navigate(`/browse?q=${encodeURIComponent(search)}`);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand" style={{ padding: '6px var(--s-3) var(--s-4)' }}>
          <Logo to="/app" />
        </div>

        {nav.map((n, i) =>
          n.section ? (
            <div className="sidebar-section" key={`s-${i}`}>
              {n.section}
            </div>
          ) : (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => `sidelink ${isActive ? 'active' : ''}`}
              title={n.label}
            >
              <Icon name={n.icon} size={18} />
              <span className="sidelink-text">{n.label}</span>
              {n.badge && badgeValue(n.badge) > 0 && (
                <span className="sidelink-count">{badgeValue(n.badge)}</span>
              )}
            </NavLink>
          )
        )}

        <div className="sidebar-foot" style={{ marginTop: 'auto' }}>
          {isAdmin && variant !== 'admin' && (
            <NavLink to="/admin" className="sidelink" title="Admin console">
              <Icon name="shield" size={18} />
              <span className="sidelink-text">Admin Console</span>
            </NavLink>
          )}
          <button
            className="sidelink"
            style={{ width: '100%' }}
            onClick={() => {
              logout();
              navigate('/');
            }}
            title="Logout"
          >
            <Icon name="logout" size={18} />
            <span className="sidelink-text">Logout</span>
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <form className="search" onSubmit={submitSearch}>
            <span className="input-icon">
              <Icon name="search" size={16} />
            </span>
            <input
              className="input"
              placeholder="Search all items, categories or locations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>

          <div className="row gap-3 ml-auto">
            <Button to="/browse" variant="subtle" size="sm" icon="grid" className="hide-sm">
              Browse
            </Button>
            <button
              className="bell"
              onClick={() => setPanelOpen((o) => !o)}
              aria-label={`Notifications (${counts.unread} unread)`}
            >
              <Icon name="bell" size={18} />
              {counts.unread > 0 && <span className="bell-dot" />}
            </button>
            <NavLink to="/app/profile" className="row gap-3" style={{ color: 'inherit' }}>
              <div className="hide-sm" style={{ textAlign: 'right', lineHeight: 1.25 }}>
                <div className="small strong">{user?.name}</div>
                <div className="tiny faint">{isAdmin ? 'Administrator' : 'Member'}</div>
              </div>
              <Avatar name={user?.name} hue={user?.avatar_hue} />
            </NavLink>
          </div>
        </header>

        <main className="page">
          <Outlet context={{ refreshNotifications: refresh, counts }} />
        </main>
      </div>

      {panelOpen && (
        <NotificationsPanel
          items={notifications}
          onClose={() => setPanelOpen(false)}
          onRefresh={refresh}
        />
      )}
    </div>
  );
}
