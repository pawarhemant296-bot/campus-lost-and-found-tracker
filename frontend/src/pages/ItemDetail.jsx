import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api/client.js';
import { ErrorBanner, Loading } from '../components/Feedback.jsx';
import { ScoreRing } from '../components/MatchScore.jsx';
import StatusTimeline from '../components/StatusTimeline.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import useApi from '../hooks/useApi.js';
import { categoryIcon, formatDate, humanStatus, relativeTime, statusTone } from '../utils/format.js';

/** Item Details - photo, description, status, matches and claim actions. */
export default function ItemDetail() {
  const { id } = useParams();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, error, loading, reload } = useApi(`/items/${id}`);
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading />;
  if (error) {
    return (
      <div className="container">
        <ErrorBanner error={error} onRetry={reload} />
      </div>
    );
  }

  const { item, matches = [], claims = [], timeline = [] } = data;
  const isOwner = Boolean(item.is_owner);
  const isResolved = ['RETURNED', 'CLOSED'].includes(item.status);
  const myClaim = claims.find((claim) => claim.claimant_id === user?.user_id);

  const act = async (label, action) => {
    setBusy(true);
    try {
      await action();
      toast.success(label);
      reload();
    } catch (actionError) {
      toast.error(actionError.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Delete this report permanently?')) return;
    try {
      await api.delete(`/items/${item.item_id}`);
      toast.success('Report deleted');
      navigate('/my-reports');
    } catch (deleteError) {
      toast.error(deleteError.message);
    }
  };

  return (
    <div className="container">
      <div className="row small muted" style={{ marginBottom: 12 }}>
        <Link to="/search">← Back to search</Link>
      </div>

      <div className="detail-layout">
        {/* ---------------- main column ---------------- */}
        <div className="stack">
          <div className="card">
            <div className="row" style={{ gap: 8, marginBottom: 10 }}>
              <span className={`badge badge-${item.type}`}>{item.type} item</span>
              <span className={statusTone(item.status)}>{humanStatus(item.status)}</span>
              {Number(item.is_hidden) === 1 && <span className="badge badge-danger">hidden by moderator</span>}
              {item.has_secret_details && <span className="badge badge-info">🔐 verification enabled</span>}
            </div>

            <h1 style={{ marginBottom: 6 }}>{item.title}</h1>
            <p className="muted small">
              Reported by {item.reporter?.name ?? 'a user'} · {relativeTime(item.created_at)}
            </p>

            {item.image_url && <img className="item-hero-image" src={item.image_url} alt={item.title} />}

            {item.description && <p style={{ marginTop: 14, whiteSpace: 'pre-wrap' }}>{item.description}</p>}

            <dl className="definition-list" style={{ marginTop: 14 }}>
              <dt>Category</dt>
              <dd>
                {categoryIcon(item.category)} {item.category}
              </dd>
              <dt>{item.type === 'lost' ? 'Lost at' : 'Found at'}</dt>
              <dd>📍 {item.location}</dd>
              <dt>Date &amp; time</dt>
              <dd>🕒 {formatDate(item.occurred_at)}</dd>
              {item.latitude != null && item.longitude != null && (
                <>
                  <dt>Coordinates</dt>
                  <dd>
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${item.latitude}&mlon=${item.longitude}#map=18/${item.latitude}/${item.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {Number(item.latitude).toFixed(5)}, {Number(item.longitude).toFixed(5)} — open map
                    </a>
                  </dd>
                </>
              )}
              {item.resolved_at && (
                <>
                  <dt>Resolved</dt>
                  <dd>{formatDate(item.resolved_at)}</dd>
                </>
              )}
            </dl>
          </div>

          {/* possible matches */}
          <div className="card">
            <div className="card-head">
              <h2>Possible matches</h2>
              {isOwner && !isResolved && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy}
                  onClick={() => act('Matching engine re-run', () => api.post(`/items/${item.item_id}/rematch`))}
                >
                  ↻ Re-run engine
                </button>
              )}
            </div>
            {matches.length === 0 ? (
              <p className="muted small">
                No report on the other side has scored above the threshold yet. Every new report is compared
                automatically.
              </p>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {matches.map((match) => {
                  const counterpart = Number(match.lost_item?.item_id) === Number(item.item_id) ? match.found_item : match.lost_item;
                  return (
                    <div key={match.match_id} className="row" style={{ gap: 14, alignItems: 'center' }}>
                      <ScoreRing score={match.match_score} size={56} />
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <strong>{counterpart?.title ?? 'Report removed'}</strong>
                        <div className="muted small">
                          {counterpart ? `📍 ${counterpart.location} · ${formatDate(counterpart.occurred_at)}` : ''}
                        </div>
                        <div className="muted tiny">{match.breakdown?.reasons?.slice(0, 2).join(' · ')}</div>
                      </div>
                      <Link className="btn btn-sm btn-ghost" to={`/matches/${match.match_id}`}>
                        Details
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* claims on this item */}
          {claims.length > 0 && (
            <div className="card">
              <div className="card-head">
                <h2>Claims</h2>
                <span className="muted small">{claims.length} total</span>
              </div>
              <div className="stack" style={{ gap: 10 }}>
                {claims.map((claim) => (
                  <Link
                    key={claim.claim_id}
                    to={`/claims/${claim.claim_id}`}
                    className="card card-tight"
                    style={{ boxShadow: 'none', color: 'inherit' }}
                  >
                    <div className="row row-between">
                      <strong>{claim.claimant_name ?? `User #${claim.claimant_id}`}</strong>
                      <span className={statusTone(claim.status)}>{humanStatus(claim.status)}</span>
                    </div>
                    <div className="muted small">
                      {relativeTime(claim.created_at)}
                      {claim.auto_score != null && ` · automatic proof score ${claim.auto_score}%`}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ---------------- side column ---------------- */}
        <div className="stack">
          <div className="card">
            <h3>What happens next</h3>
            <StatusTimeline timeline={timeline} />
          </div>

          <div className="card">
            <h3>Actions</h3>
            <div className="stack" style={{ gap: 9 }}>
              {!user && (
                <>
                  <Link className="btn btn-block" to="/login">
                    Sign in to claim this item
                  </Link>
                  <p className="muted tiny">You need an account so the finder can verify you and contact you.</p>
                </>
              )}

              {user && !isOwner && !isResolved && (
                <>
                  {myClaim ? (
                    <Link className="btn btn-block" to={`/claims/${myClaim.claim_id}`}>
                      View my claim ({humanStatus(myClaim.status)})
                    </Link>
                  ) : (
                    <Link className="btn btn-block" to={`/items/${item.item_id}/claim`}>
                      🔐 Claim this item
                    </Link>
                  )}
                  <Link className="btn btn-ghost btn-block" to={`/messages/${item.item_id}/${item.reporter.user_id}`}>
                    💬 Message the reporter
                  </Link>
                  <p className="muted tiny">
                    Claiming asks you for a private detail. Contact information is shared only after the claim is
                    approved.
                  </p>
                </>
              )}

              {isOwner && (
                <>
                  <Link className="btn btn-ghost btn-block" to={`/items/${item.item_id}/edit`}>
                    ✏️ Edit report
                  </Link>
                  {!isResolved && (
                    <button
                      type="button"
                      className="btn btn-success btn-block"
                      disabled={busy}
                      onClick={() => act('Case closed', () => api.post(`/items/${item.item_id}/close`))}
                    >
                      ✓ Close this case
                    </button>
                  )}
                  <button type="button" className="btn btn-danger btn-block" onClick={remove}>
                    🗑 Delete report
                  </button>
                </>
              )}

              {isResolved && <div className="alert alert-success" style={{ margin: 0 }}>This case is resolved. 🎉</div>}

              {isAdmin && (
                <>
                  <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '6px 0' }} />
                  <span className="label">Moderation</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-block btn-sm"
                    disabled={busy}
                    onClick={() =>
                      act(Number(item.is_hidden) === 1 ? 'Report restored' : 'Report hidden', () =>
                        api.patch(`/admin/items/${item.item_id}/hide`, {
                          hidden: Number(item.is_hidden) !== 1,
                          reason: 'Reviewed by moderator',
                        }),
                      )
                    }
                  >
                    {Number(item.is_hidden) === 1 ? '👁 Restore report' : '🛡 Hide report'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="card">
            <h3>Privacy</h3>
            <p className="muted small" style={{ margin: 0 }}>
              The private verification detail for this item is never returned by the API — not even to the person who
              filed the report. Email and phone numbers are unlocked only when a claim is approved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
