import { useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { Button, Empty } from './ui.jsx';
import { NotificationsAPI } from '../lib/api.js';
import { timeAgo } from '../lib/format.js';

const ICONS = { match: 'target', claim: 'shield', message: 'message', system: 'sparkle' };

export default function NotificationsPanel({ items = [], onClose, onRefresh }) {
  const navigate = useNavigate();

  const open = async (n) => {
    if (!n.read_status) {
      await NotificationsAPI.read(n.id).catch(() => {});
      onRefresh?.();
    }
    onClose?.();
    if (n.link) navigate(n.link);
  };

  const markAll = async () => {
    await NotificationsAPI.readAll().catch(() => {});
    onRefresh?.();
  };

  return (
    <>
      <div className="panel-overlay" onClick={onClose} />
      <aside className="slide-panel" role="dialog" aria-label="Notifications">
        <div className="card-head" style={{ padding: 'var(--s-4)' }}>
          <div className="row gap-3">
            <span className="notif-icon">
              <Icon name="bell" size={16} />
            </span>
            <div>
              <h4 style={{ fontSize: 'var(--fs-md)' }}>Notifications</h4>
              <div className="tiny muted">
                {items.filter((n) => !n.read_status).length} unread
              </div>
            </div>
          </div>
          <div className="row gap-2">
            <Button variant="subtle" size="sm" onClick={markAll}>
              Mark all read
            </Button>
            <button className="btn btn-icon btn-subtle" onClick={onClose} aria-label="Close">
              <Icon name="x" size={15} />
            </button>
          </div>
        </div>

        <div style={{ overflowY: 'auto' }}>
          {items.length === 0 ? (
            <Empty
              icon="bell"
              title="Nothing yet"
              message="Match alerts, claim updates and messages will land here."
            />
          ) : (
            items.map((n) => (
              <button
                key={n.id}
                className={`notif ${n.read_status ? '' : 'unread'}`}
                onClick={() => open(n)}
              >
                <span className="notif-icon">
                  <Icon name={ICONS[n.type] || 'sparkle'} size={16} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="notif-title">{n.title}</div>
                  <div className="tiny muted clamp-2">{n.message}</div>
                  <div className="tiny faint mt-2">{timeAgo(n.created_at)}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
