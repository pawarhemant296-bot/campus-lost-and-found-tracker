import { Link } from 'react-router-dom';
import { categoryIcon, formatDate, humanStatus, scoreLabel, statusTone } from '../utils/format.js';
import { ScoreRing } from './MatchScore.jsx';

/** One row on the Possible Matches screen: score + both sides of the pair. */
export default function MatchCard({ match, currentUserId }) {
  const lost = match.lost_item;
  const found = match.found_item;
  const mineIsLost = lost?.user_id === currentUserId;
  const counterpart = mineIsLost ? found : lost;

  return (
    <div className="card">
      <div className="row" style={{ alignItems: 'flex-start', gap: 16 }}>
        <ScoreRing score={match.match_score} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="row" style={{ gap: 6 }}>
            <strong>{scoreLabel(match.match_score)}</strong>
            <span className={statusTone(match.status)}>{humanStatus(match.status)}</span>
          </div>
          <p className="small muted" style={{ margin: '4px 0 8px' }}>
            {match.breakdown?.reasons?.slice(0, 3).join(' · ') || 'Scored by the matching engine'}
          </p>
          <div className="grid grid-2" style={{ gap: 10 }}>
            <MatchSide item={lost} label="Lost report" mine={lost?.user_id === currentUserId} />
            <MatchSide item={found} label="Found report" mine={found?.user_id === currentUserId} />
          </div>
        </div>
        <div className="stack" style={{ gap: 8, minWidth: 150 }}>
          <Link className="btn btn-sm" to={`/matches/${match.match_id}`}>
            Review match
          </Link>
          {counterpart && (
            <Link className="btn btn-sm btn-ghost" to={`/items/${counterpart.item_id}`}>
              Open their report
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function MatchSide({ item, label, mine }) {
  if (!item) return <div className="muted small">{label}: report removed</div>;
  return (
    <div className="card card-tight" style={{ boxShadow: 'none', background: 'var(--surface-2)' }}>
      <div className="row row-between" style={{ gap: 6, marginBottom: 4 }}>
        <span className={`badge badge-${item.type}`}>{label}</span>
        {mine && <span className="badge badge-brand">yours</span>}
      </div>
      <Link to={`/items/${item.item_id}`} style={{ fontWeight: 600, color: 'inherit' }}>
        {item.title}
      </Link>
      <div className="item-meta small">
        <span>
          {categoryIcon(item.category)} {item.category}
        </span>
        <span>📍 {item.location}</span>
        <span>🕒 {formatDate(item.occurred_at)}</span>
      </div>
    </div>
  );
}
