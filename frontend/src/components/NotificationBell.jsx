import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext.jsx';
import { relativeTime } from '../utils/format.js';

const ICONS = {
  MATCH_FOUND: '🎯',
  CLAIM_SUBMITTED: '📝',
  CLAIM_APPROVED: '✅',
  CLAIM_REJECTED: '⛔',
  HANDOVER_CONFIRMED: '🤝',
  MESSAGE_RECEIVED: '💬',
  ITEM_MODERATED: '🛡️',
};

export default function NotificationBell() {
  const { notifications, unread, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const container = useRef(null);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event) => {
      if (container.current && !container.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="bell" ref={container} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        aria-expanded={open}
      >
        🔔
        {unread > 0 && <span className="bell-count">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="dropdown">
          <div className="dropdown-head">
            <span>Notifications</span>
            {unread > 0 && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="empty" style={{ padding: '28px 16px' }}>
              <div className="empty-icon">🔔</div>
              <div className="small">You are all caught up.</div>
            </div>
          ) : (
            notifications.map((notification) => (
              <Link
                key={notification.notification_id}
                to={notification.link || '/dashboard'}
                className={`notification-row${Number(notification.read_status) === 0 ? ' unread' : ''}`}
                onClick={() => {
                  if (Number(notification.read_status) === 0) markRead(notification.notification_id);
                  setOpen(false);
                }}
              >
                <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                  <span>{ICONS[notification.type] ?? '🔔'}</span>
                  <div>
                    <strong>{notification.title || notification.type}</strong>
                    <div className="muted small">{notification.message}</div>
                    <div className="muted tiny">{relativeTime(notification.created_at)}</div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
