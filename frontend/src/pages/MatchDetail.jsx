import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/client.js';
import { ErrorBanner, Loading } from '../components/Feedback.jsx';
import { MatchBreakdown, ScoreRing } from '../components/MatchScore.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import useApi from '../hooks/useApi.js';
import { categoryIcon, formatDate, humanStatus, scoreLabel, statusTone } from '../utils/format.js';

/** One match, with the full "why" panel and the next action for this user. */
export default function MatchDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const { data, error, loading, reload } = useApi(`/matches/${id}`);
  const [busy, setBusy] = useState(false);

  if (loading) return <Loading />;
  if (error) {
    return (
      <div className="container">
        <ErrorBanner error={error} onRetry={reload} />
      </div>
    );
  }

  const match = data.match;
  const lost = match.lost_item;
  const found = match.found_item;
  const mineIsLost = lost?.user_id === user.user_id;
  const mine = mineIsLost ? lost : found;
  const theirs = mineIsLost ? found : lost;

  const setStatus = async (status) => {
    setBusy(true);
    try {
      await api.patch(`/matches/${id}/status`, { status });
      toast.success(status === 'CONFIRMED' ? 'Match confirmed' : 'Match dismissed');
      reload();
    } catch (statusError) {
      toast.error(statusError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container">
      <div className="row small muted" style={{ marginBottom: 12 }}>
        <Link to="/matches">← All matches</Link>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 18, alignItems: 'center' }}>
          <ScoreRing score={match.match_score} size={96} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="row" style={{ gap: 8 }}>
              <h1 style={{ margin: 0 }}>{scoreLabel(match.match_score)}</h1>
              <span className={statusTone(match.status)}>{humanStatus(match.status)}</span>
            </div>
            <p className="muted" style={{ margin: '6px 0 0' }}>
              {match.breakdown?.reasons?.join(' · ') || 'Scored by the matching engine.'}
            </p>
          </div>
        </div>
      </div>

      <div className="detail-layout">
        <div className="stack">
          <div className="card">
            <h2>Why these two match</h2>
            <p className="muted small">
              Each factor is scored 0–100% and multiplied by its weight. Everything is computed server-side by the
              matching engine.
            </p>
            <MatchBreakdown breakdown={match.breakdown} />
          </div>

          <div className="grid grid-2">
            <SideCard item={lost} label="Lost report" mine={lost?.user_id === user.user_id} />
            <SideCard item={found} label="Found report" mine={found?.user_id === user.user_id} />
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h3>Next step</h3>
            {theirs?.type === 'found' ? (
              <>
                <p className="muted small">
                  If this is your item, submit a claim. You will be asked for a private detail so the finder can verify
                  you are the real owner.
                </p>
                <Link className="btn btn-block" to={`/items/${theirs.item_id}/claim`}>
                  🔐 Claim this item
                </Link>
              </>
            ) : (
              <>
                <p className="muted small">
                  You reported the found item. Wait for the owner to claim it, or message them to arrange verification.
                </p>
                {theirs && (
                  <Link className="btn btn-block btn-ghost" to={`/items/${theirs.item_id}`}>
                    Open their lost report
                  </Link>
                )}
              </>
            )}

            {theirs && (
              <Link className="btn btn-ghost btn-block" style={{ marginTop: 8 }} to={`/messages/${mine?.item_id ?? theirs.item_id}/${theirs.user_id}`}>
                💬 Message them
              </Link>
            )}
          </div>

          <div className="card">
            <h3>Is this match right?</h3>
            <p className="muted small">Your feedback keeps the queue clean for both sides.</p>
            <div className="stack" style={{ gap: 8 }}>
              <button type="button" className="btn btn-success btn-block" disabled={busy || match.status === 'CONFIRMED'} onClick={() => setStatus('CONFIRMED')}>
                ✓ Yes, same item
              </button>
              <button type="button" className="btn btn-ghost btn-block" disabled={busy || match.status === 'REJECTED'} onClick={() => setStatus('REJECTED')}>
                ✕ Not my item
              </button>
            </div>
          </div>

          <div className="card">
            <h3>Match details</h3>
            <dl className="definition-list">
              <dt>Match ID</dt>
              <dd className="mono">#{match.match_id}</dd>
              <dt>Score</dt>
              <dd>{match.match_score}%</dd>
              <dt>Created</dt>
              <dd>{formatDate(match.created_at)}</dd>
              <dt>Scoring</dt>
              <dd>{match.breakdown?.ai_used ? 'heuristics + AI service' : 'local heuristics'}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

function SideCard({ item, label, mine }) {
  if (!item) {
    return (
      <div className="card">
        <h3>{label}</h3>
        <p className="muted small">This report has been removed.</p>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="row row-between" style={{ marginBottom: 8 }}>
        <span className={`badge badge-${item.type}`}>{label}</span>
        {mine && <span className="badge badge-brand">yours</span>}
      </div>
      {item.image_url && <img className="item-hero-image" style={{ maxHeight: 180 }} src={item.image_url} alt={item.title} />}
      <h3 style={{ marginTop: 10 }}>
        <Link to={`/items/${item.item_id}`} style={{ color: 'inherit' }}>
          {item.title}
        </Link>
      </h3>
      <p className="muted small" style={{ whiteSpace: 'pre-wrap' }}>
        {item.description || 'No description provided.'}
      </p>
      <dl className="definition-list">
        <dt>Category</dt>
        <dd>
          {categoryIcon(item.category)} {item.category}
        </dd>
        <dt>Location</dt>
        <dd>📍 {item.location}</dd>
        <dt>When</dt>
        <dd>🕒 {formatDate(item.occurred_at)}</dd>
        <dt>Status</dt>
        <dd>
          <span className={statusTone(item.status)}>{humanStatus(item.status)}</span>
        </dd>
      </dl>
    </div>
  );
}
