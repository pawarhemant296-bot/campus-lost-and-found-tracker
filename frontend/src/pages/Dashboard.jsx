import { Link } from 'react-router-dom';
import { Empty, ErrorBanner, Loading } from '../components/Feedback.jsx';
import ItemCard from '../components/ItemCard.jsx';
import MatchCard from '../components/MatchCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import useApi from '../hooks/useApi.js';
import { humanStatus, relativeTime, statusTone } from '../utils/format.js';

/** User Dashboard - lost/found counts and recent matches (spec section 12). */
export default function Dashboard() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApi('/items/dashboard');

  if (loading) return <Loading label="Loading your dashboard…" />;

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Hello, {user.name.split(' ')[0]}</h1>
          <p>Everything you reported, matched and claimed in one place.</p>
        </div>
        <div className="row">
          <Link className="btn btn-danger" to="/report/lost">
            Report lost item
          </Link>
          <Link className="btn btn-success" to="/report/found">
            Report found item
          </Link>
        </div>
      </div>

      <ErrorBanner error={error} onRetry={reload} />

      {data && (
        <>
          <div className="grid grid-4">
            <Stat value={data.counts.lost} label="Lost reports" />
            <Stat value={data.counts.found} label="Found reports" />
            <Stat value={data.counts.matches} label="Possible matches" accent="var(--brand)" />
            <Stat value={data.counts.resolved} label="Resolved" accent="var(--found)" />
          </div>

          {data.counts.strong_matches > 0 && (
            <div className="alert alert-info" style={{ marginTop: 18 }}>
              🎯 You have <strong>{data.counts.strong_matches}</strong> strong match
              {data.counts.strong_matches > 1 ? 'es' : ''} waiting. <Link to="/matches">Review them now</Link>.
            </div>
          )}

          <div className="grid grid-2" style={{ marginTop: 20, alignItems: 'start' }}>
            <div className="card">
              <div className="card-head">
                <h2>Claims to review</h2>
                <Link className="small" to="/claims">
                  All claims
                </Link>
              </div>
              {data.claims_to_review.length === 0 ? (
                <p className="muted small">Nobody has claimed your found items yet.</p>
              ) : (
                <div className="stack" style={{ gap: 10 }}>
                  {data.claims_to_review.map((claim) => (
                    <Link key={claim.claim_id} to={`/claims/${claim.claim_id}`} className="card card-tight" style={{ boxShadow: 'none', color: 'inherit' }}>
                      <div className="row row-between">
                        <strong>{claim.item_title}</strong>
                        <span className={statusTone(claim.status)}>{humanStatus(claim.status)}</span>
                      </div>
                      <div className="muted small">
                        {claim.claimant_name} · {relativeTime(claim.created_at)}
                        {claim.auto_score != null && ` · proof score ${claim.auto_score}%`}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <div className="card-head">
                <h2>My claims</h2>
                <Link className="small" to="/claims">
                  All claims
                </Link>
              </div>
              {data.my_claims.length === 0 ? (
                <p className="muted small">You have not claimed any item yet.</p>
              ) : (
                <div className="stack" style={{ gap: 10 }}>
                  {data.my_claims.map((claim) => (
                    <Link key={claim.claim_id} to={`/claims/${claim.claim_id}`} className="card card-tight" style={{ boxShadow: 'none', color: 'inherit' }}>
                      <div className="row row-between">
                        <strong>{claim.item_title}</strong>
                        <span className={statusTone(claim.status)}>{humanStatus(claim.status)}</span>
                      </div>
                      <div className="muted small">Submitted {relativeTime(claim.created_at)}</div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 26 }}>
            <div className="page-head">
              <h2>Recent possible matches</h2>
              <Link className="btn btn-ghost btn-sm" to="/matches">
                View all matches
              </Link>
            </div>
            {data.recent_matches.length === 0 ? (
              <Empty icon="🎯" title="No matches yet">
                As soon as somebody reports the opposite side of one of your items, the engine will score it and notify
                you here.
              </Empty>
            ) : (
              <div className="stack">
                {data.recent_matches.map((match) => (
                  <MatchCard key={match.match_id} match={match} currentUserId={user.user_id} />
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: 26 }}>
            <div className="page-head">
              <h2>My latest reports</h2>
              <Link className="btn btn-ghost btn-sm" to="/my-reports">
                My reports
              </Link>
            </div>
            {data.recent_items.length === 0 ? (
              <Empty icon="📝" title="You have not filed a report yet">
                <Link to="/report/lost">Report a lost item</Link> or <Link to="/report/found">something you found</Link>.
              </Empty>
            ) : (
              <div className="grid grid-3">
                {data.recent_items.map((item) => (
                  <ItemCard key={item.item_id} item={item} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ value, label, accent }) {
  return (
    <div className="stat">
      <div className="stat-value" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
