import { useCallback, useEffect, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import {
  Avatar,
  Button,
  Card,
  Empty,
  LoadingBlock,
  useToast,
} from '../../components/ui.jsx';
import { AdminAPI } from '../../lib/api.js';
import { formatDate } from '../../lib/format.js';
import { useAuth } from '../../lib/auth.jsx';

export default function AdminUsers() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    AdminAPI.users(q)
      .then((d) => setUsers(d.users || []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, 220);
    return () => clearTimeout(t);
  }, [load]);

  const update = async (u, payload, message) => {
    try {
      await AdminAPI.updateUser(u.id, payload);
      toast.success(message);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow mb-2">Manage users</div>
          <h1>Members &amp; roles</h1>
          <p>Promote moderators, suspend abusive accounts and see who is actually returning items.</p>
        </div>
        <div className="search" style={{ maxWidth: 300 }}>
          <span className="input-icon">
            <Icon name="search" size={16} />
          </span>
          <input
            className="input"
            placeholder="Search name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <Card className="card-pad">
          <LoadingBlock rows={5} />
        </Card>
      ) : users.length === 0 ? (
        <Card className="card-pad">
          <Empty icon="users" title="No users match that search" />
        </Card>
      ) : (
        <Card>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Reports</th>
                  <th>Claims</th>
                  <th>Resolved</th>
                  <th>Joined</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="row gap-3">
                        <Avatar name={u.name} hue={u.avatar_hue} size="sm" />
                        <div style={{ minWidth: 0 }}>
                          <div className="cell-strong truncate">
                            {u.name} {u.id === me.id && <span className="tiny faint">(you)</span>}
                          </div>
                          <div className="tiny faint truncate">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${u.role === 'admin' ? 'badge-violet' : 'badge-reported'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${u.status === 'active' ? 'returned' : 'closed'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="mono">{u.reports}</td>
                    <td className="mono">{u.claims}</td>
                    <td className="mono">{u.resolved}</td>
                    <td className="tiny faint">{formatDate(u.created_at)}</td>
                    <td>
                      <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
                        <Button
                          size="sm"
                          variant="subtle"
                          onClick={() =>
                            update(
                              u,
                              { role: u.role === 'admin' ? 'user' : 'admin' },
                              u.role === 'admin' ? 'Demoted to member' : 'Promoted to admin'
                            )
                          }
                          disabled={u.id === me.id}
                        >
                          {u.role === 'admin' ? 'Demote' : 'Make admin'}
                        </Button>
                        <Button
                          size="sm"
                          variant={u.status === 'active' ? 'subtle' : 'ghost'}
                          onClick={() =>
                            update(
                              u,
                              { status: u.status === 'active' ? 'suspended' : 'active' },
                              u.status === 'active' ? 'Account suspended' : 'Account reactivated'
                            )
                          }
                          disabled={u.id === me.id}
                        >
                          {u.status === 'active' ? 'Suspend' : 'Reactivate'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
