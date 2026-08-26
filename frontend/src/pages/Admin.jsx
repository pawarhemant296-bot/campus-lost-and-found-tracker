import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client.js';
import { ErrorBanner, Loading } from '../components/Feedback.jsx';
import { ScoreRing } from '../components/MatchScore.jsx';
import { useToast } from '../context/ToastContext.jsx';
import useApi from '../hooks/useApi.js';
import { formatDate, humanStatus, relativeTime, statusTone } from '../utils/format.js';

const TABS = [
  { key: 'analytics', label: 'Analytics' },
  { key: 'claims', label: 'Claims & disputes' },
  { key: 'items', label: 'Reports' },
  { key: 'users', label: 'Users' },
  { key: 'matches', label: 'Matches' },
  { key: 'audit', label: 'Audit log' },
];

/** Admin Dashboard - users, reports, claims and analytics (spec section 12). */
export default function Admin() {
  const [tab, setTab] = useState('analytics');
  const toast = useToast();
  const overview = useApi('/admin/overview');

  const act = async (label, action, reload) => {
    try {
      await action();
      toast.success(label);
      reload?.();
      overview.reload();
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (overview.loading) return <Loading label="Loading admin dashboard…" />;

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Admin dashboard</h1>
          <p>Moderation, dispute handling and analytics for the whole platform.</p>
        </div>
      </div>

      <ErrorBanner error={overview.error} onRetry={overview.reload} />

      <div className="tabs">
        {TABS.map((entry) => (
          <button key={entry.key} type="button" className={`tab${tab === entry.key ? ' active' : ''}`} onClick={() => setTab(entry.key)}>
            {entry.label}
          </button>
        ))}
      </div>

      {tab === 'analytics' && overview.data && <Analytics data={overview.data} />}
      {tab === 'claims' && <ClaimsTab />}
      {tab === 'items' && <ItemsTab act={act} />}
      {tab === 'users' && <UsersTab act={act} />}
      {tab === 'matches' && <MatchesTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  );
}

function Analytics({ data }) {
  const maxHotspot = Math.max(...data.analytics.hotspots.map((entry) => entry.total), 1);
  return (
    <>
      <div className="grid grid-4">
        <Stat value={data.users.total} label="Users" note={`${data.users.admins} admin · ${data.users.blocked} blocked`} />
        <Stat value={data.items.total} label="Reports" note={`${data.items.lost} lost · ${data.items.found} found`} />
        <Stat value={data.matches.total} label="Matches" note={`avg score ${data.matches.average_score}%`} accent="var(--brand)" />
        <Stat
          value={`${data.analytics.resolution_rate}%`}
          label="Resolution rate"
          note={`${data.items.returned + data.items.closed} items returned`}
          accent="var(--found)"
        />
      </div>

      <div className="grid grid-2" style={{ marginTop: 18, alignItems: 'start' }}>
        <div className="card">
          <h3>Claim pipeline</h3>
          <table className="data">
            <tbody>
              {[
                ['Pending', data.claims.pending],
                ['Under review', data.claims.under_review],
                ['Approved', data.claims.approved],
                ['Rejected', data.claims.rejected],
                ['Handover confirmed', data.claims.handover_confirmed],
              ].map(([label, value]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Location hotspots</h3>
          <p className="muted small">Where items go missing most often — the heatmap data.</p>
          {data.analytics.hotspots.map((entry) => (
            <div className="heat-row" key={entry.location}>
              <span title={entry.location} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.location}
              </span>
              <div className="heat-bar">
                <div style={{ width: `${(entry.total / maxHotspot) * 100}%` }} />
              </div>
              <strong>{entry.total}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h3>Category breakdown</h3>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Category</th>
                <th>Lost</th>
                <th>Found</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {data.analytics.categories.map((row) => (
                <tr key={row.category}>
                  <td>{row.category}</td>
                  <td>{row.lost}</td>
                  <td>{row.found}</td>
                  <td>
                    <strong>{row.total}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <h3>Recent moderation activity</h3>
        {data.recent_activity.length === 0 ? (
          <p className="muted small">No moderation actions recorded yet.</p>
        ) : (
          <ul className="small" style={{ paddingLeft: 18, margin: 0 }}>
            {data.recent_activity.map((entry) => (
              <li key={entry.log_id}>
                <strong>{entry.action.replace(/_/g, ' ').toLowerCase()}</strong> · {entry.entity_type} #{entry.entity_id} ·{' '}
                {entry.actor_name ?? 'system'} <span className="muted">({relativeTime(entry.created_at)})</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function ClaimsTab() {
  const [status, setStatus] = useState('');
  const { data, error, loading, reload } = useApi(`/admin/claims${status ? `?status=${status}` : ''}`, [status]);

  if (loading) return <Loading />;
  return (
    <div className="card">
      <div className="card-head">
        <h3>All claims</h3>
        <select value={status} onChange={(event) => setStatus(event.target.value)} style={{ maxWidth: 220 }}>
          <option value="">Any status</option>
          {['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'HANDOVER_CONFIRMED'].map((entry) => (
            <option key={entry} value={entry}>
              {entry.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>
      <ErrorBanner error={error} onRetry={reload} />
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>Claimant</th>
              <th>Finder</th>
              <th>Proof</th>
              <th>Status</th>
              <th>Filed</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(data?.claims ?? []).map((claim) => (
              <tr key={claim.claim_id}>
                <td className="mono">{claim.claim_id}</td>
                <td>
                  <Link to={`/items/${claim.item_id}`}>{claim.item_title}</Link>
                </td>
                <td>{claim.claimant_name}</td>
                <td>{claim.item_owner_name}</td>
                <td>{claim.auto_score == null ? '—' : `${claim.auto_score}%`}</td>
                <td>
                  <span className={statusTone(claim.status)}>{humanStatus(claim.status)}</span>
                </td>
                <td>{relativeTime(claim.created_at)}</td>
                <td>
                  <Link className="btn btn-sm btn-ghost" to={`/claims/${claim.claim_id}`}>
                    {['PENDING', 'UNDER_REVIEW'].includes(claim.status) ? 'Resolve' : 'Open'}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted tiny" style={{ marginTop: 10, marginBottom: 0 }}>
        As an administrator you can approve, reject or confirm handover on any claim — used to settle disputes when the
        finder is unavailable.
      </p>
    </div>
  );
}

function ItemsTab({ act }) {
  const [query, setQuery] = useState('');
  const { data, error, loading, reload } = useApi(`/items?limit=50&include_hidden=true${query ? `&q=${encodeURIComponent(query)}` : ''}`, [query]);

  return (
    <div className="card">
      <div className="card-head">
        <h3>Reports</h3>
        <input placeholder="Search reports…" value={query} onChange={(event) => setQuery(event.target.value)} style={{ maxWidth: 260 }} />
      </div>
      <ErrorBanner error={error} onRetry={reload} />
      {loading ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Type</th>
                <th>Category</th>
                <th>Reporter</th>
                <th>Status</th>
                <th>Filed</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((item) => (
                <tr key={item.item_id}>
                  <td className="mono">{item.item_id}</td>
                  <td>
                    <Link to={`/items/${item.item_id}`}>{item.title}</Link>
                    {Number(item.is_hidden) === 1 && <span className="badge badge-danger" style={{ marginLeft: 6 }}>hidden</span>}
                  </td>
                  <td>
                    <span className={`badge badge-${item.type}`}>{item.type}</span>
                  </td>
                  <td>{item.category}</td>
                  <td>{item.reporter?.name}</td>
                  <td>
                    <span className={statusTone(item.status)}>{humanStatus(item.status)}</span>
                  </td>
                  <td>{relativeTime(item.created_at)}</td>
                  <td className="nowrap">
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() =>
                        act(
                          Number(item.is_hidden) === 1 ? 'Report restored' : 'Report hidden',
                          () =>
                            api.patch(`/admin/items/${item.item_id}/hide`, {
                              hidden: Number(item.is_hidden) !== 1,
                              reason: 'Moderator action from admin dashboard',
                            }),
                          reload,
                        )
                      }
                    >
                      {Number(item.is_hidden) === 1 ? 'Restore' : 'Hide'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UsersTab({ act }) {
  const [query, setQuery] = useState('');
  const { data, error, loading, reload } = useApi(`/admin/users${query ? `?q=${encodeURIComponent(query)}` : ''}`, [query]);

  return (
    <div className="card">
      <div className="card-head">
        <h3>Users</h3>
        <input placeholder="Search name or email…" value={query} onChange={(event) => setQuery(event.target.value)} style={{ maxWidth: 260 }} />
      </div>
      <ErrorBanner error={error} onRetry={reload} />
      {loading ? (
        <Loading />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Reports</th>
                <th>Claims</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(data?.users ?? []).map((entry) => (
                <tr key={entry.user_id}>
                  <td>
                    {entry.name}
                    {Number(entry.is_blocked) === 1 && <span className="badge badge-danger" style={{ marginLeft: 6 }}>blocked</span>}
                  </td>
                  <td className="small">{entry.email}</td>
                  <td>
                    <span className={entry.role === 'admin' ? 'badge badge-brand' : 'badge'}>{entry.role}</span>
                  </td>
                  <td>{entry.item_count}</td>
                  <td>{entry.claim_count}</td>
                  <td className="small">{formatDate(entry.created_at, { withTime: false })}</td>
                  <td className="nowrap">
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() =>
                        act(
                          Number(entry.is_blocked) === 1 ? 'User unblocked' : 'User blocked',
                          () => api.patch(`/admin/users/${entry.user_id}/block`, { blocked: Number(entry.is_blocked) !== 1 }),
                          reload,
                        )
                      }
                    >
                      {Number(entry.is_blocked) === 1 ? 'Unblock' : 'Block'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      onClick={() =>
                        act(
                          'Role updated',
                          () => api.patch(`/admin/users/${entry.user_id}/role`, { role: entry.role === 'admin' ? 'user' : 'admin' }),
                          reload,
                        )
                      }
                    >
                      {entry.role === 'admin' ? 'Demote' : 'Make admin'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MatchesTab() {
  const toast = useToast();
  const { data, error, loading, reload } = useApi('/admin/matches?limit=60');
  const [busy, setBusy] = useState(false);

  const rescore = async () => {
    setBusy(true);
    try {
      const result = await api.post('/matches/rescore');
      toast.success(`Re-scored ${result.rescored} match(es)`);
      reload();
    } catch (rescoreError) {
      toast.error(rescoreError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-head">
        <h3>All matches</h3>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={rescore}>
          ↻ Re-score everything
        </button>
      </div>
      <p className="muted small">
        Use re-scoring after changing the weights in <code>.env</code> or enabling the Python AI service.
      </p>
      <ErrorBanner error={error} onRetry={reload} />
      {loading ? (
        <Loading />
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          {(data?.matches ?? []).map((match) => (
            <div className="row" key={match.match_id} style={{ gap: 14 }}>
              <ScoreRing score={match.match_score} size={52} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div className="small">
                  <Link to={`/items/${match.lost_item?.item_id}`}>{match.lost_item?.title ?? 'removed'}</Link>
                  {' ↔ '}
                  <Link to={`/items/${match.found_item?.item_id}`}>{match.found_item?.title ?? 'removed'}</Link>
                </div>
                <div className="muted tiny">{match.breakdown?.reasons?.slice(0, 2).join(' · ')}</div>
              </div>
              <span className={statusTone(match.status)}>{humanStatus(match.status)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AuditTab() {
  const { data, error, loading, reload } = useApi('/admin/audit?limit=100');
  if (loading) return <Loading />;
  return (
    <div className="card">
      <h3>Audit log</h3>
      <p className="muted small">Every moderation action, for dispute handling and accountability.</p>
      <ErrorBanner error={error} onRetry={reload} />
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {(data?.logs ?? []).map((entry) => (
              <tr key={entry.log_id}>
                <td className="small nowrap">{formatDate(entry.created_at)}</td>
                <td>{entry.actor_name ?? 'system'}</td>
                <td>
                  <span className="badge">{entry.action.replace(/_/g, ' ')}</span>
                </td>
                <td className="small">
                  {entry.entity_type} #{entry.entity_id}
                </td>
                <td className="small muted">{entry.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ value, label, note, accent }) {
  return (
    <div className="stat">
      <div className="stat-value" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      <div className="stat-label">{label}</div>
      {note && <div className="muted tiny">{note}</div>}
    </div>
  );
}
