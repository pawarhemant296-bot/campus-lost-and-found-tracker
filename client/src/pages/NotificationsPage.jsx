import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import {
  Button,
  Card,
  Empty,
  LoadingBlock,
  ToggleGroup,
  useToast,
} from '../components/ui.jsx';
import { NotificationsAPI } from '../lib/api.js';
import { formatDateTime, timeAgo } from '../lib/format.js';

const ICONS = { match: 'target', claim: 'shield', message: 'message', system: 'sparkle' };

export default function NotificationsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const load = useCallback(() => {
    NotificationsAPI.list()
      .then((d) => setItems(d.notifications || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const shown = filter ? items.filter((n) => n.type === filter) : items;
  const unread = items.filter((n) => !n.read_status).length;

  const open = async (n) => {
    if (!n.read_status) await NotificationsAPI.read(n.id).catch(() => {});
    if (n.link) navigate(n.link);
    else load();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow mb-2">Notifications</div>
          <h1>{unread > 0 ? `${unread} unread alert${unread === 1 ? '' : 's'}` : 'You’re all caught up'}</h1>
          <p>Match alerts, claim updates and messages, newest first.</p>
        </div>
        <div className="row gap-3">
          <ToggleGroup
            value={filter}
            onChange={setFilter}
            options={[
              { value: '', label: 'All' },
              { value: 'match', label: 'Matches', icon: 'target' },
              { value: 'claim', label: 'Claims', icon: 'shield' },
              { value: 'message', label: 'Messages', icon: 'message' },
            ]}
          />
          {unread > 0 && (
            <Button
              variant="ghost"
              icon="check"
              onClick={async () => {
                await NotificationsAPI.readAll();
                toast.success('All notifications marked as read');
                load();
              }}
            >
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <Card className="card-pad">
          <LoadingBlock rows={5} />
        </Card>
      ) : shown.length === 0 ? (
        <Card className="card-pad">
          <Empty
            icon="bell"
            title="Nothing here yet"
            message="File a report and you'll get an alert the moment the engine finds a possible match."
          />
        </Card>
      ) : (
        <Card style={{ overflow: 'hidden' }}>
          {shown.map((n) => (
            <div key={n.id} className={`notif ${n.read_status ? '' : 'unread'}`}>
              <span className="notif-icon">
                <Icon name={ICONS[n.type] || 'sparkle'} size={16} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="row-between row-wrap">
                  <span className="notif-title">{n.title}</span>
                  <span className="tiny faint">{timeAgo(n.created_at)}</span>
                </div>
                <div className="small muted">{n.message}</div>
                <div className="row gap-3 mt-2">
                  <span className="tiny faint">{formatDateTime(n.created_at)}</span>
                  {n.link && (
                    <button className="tiny" style={{ color: 'var(--violet-300)' }} onClick={() => open(n)}>
                      Open
                    </button>
                  )}
                  <button
                    className="tiny faint"
                    onClick={async () => {
                      await NotificationsAPI.remove(n.id);
                      load();
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
