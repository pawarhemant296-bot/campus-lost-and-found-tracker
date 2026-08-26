import { useState } from 'react';
import { Empty, ErrorBanner, Loading } from '../components/Feedback.jsx';
import MatchCard from '../components/MatchCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import useApi from '../hooks/useApi.js';

const FILTERS = [
  { label: 'All matches', value: 0 },
  { label: 'Likely (60%+)', value: 60 },
  { label: 'Strong (75%+)', value: 75 },
];

/** Possible Matches - match percentage and reasons (spec section 12). */
export default function Matches() {
  const { user } = useAuth();
  const [minScore, setMinScore] = useState(0);
  const { data, error, loading, reload } = useApi(`/matches?min_score=${minScore}`, [minScore]);
  const { data: weights } = useApi('/matches/weights');

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Possible matches</h1>
          <p>Every lost/found pair the engine scored above the threshold for your reports.</p>
        </div>
      </div>

      {weights && (
        <div className="card card-tight" style={{ marginBottom: 16 }}>
          <span className="label" style={{ marginBottom: 6 }}>
            How the score is built
          </span>
          <div className="row small muted" style={{ gap: 16 }}>
            <span>Item / category {weights.weights_pct.category}%</span>
            <span>Description {weights.weights_pct.description}%</span>
            <span>Location {weights.weights_pct.location}%</span>
            <span>Date / time {weights.weights_pct.time}%</span>
            <span>Image {weights.weights_pct.image}%</span>
          </div>
        </div>
      )}

      <div className="tabs">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={`tab${minScore === filter.value ? ' active' : ''}`}
            onClick={() => setMinScore(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <ErrorBanner error={error} onRetry={reload} />

      {loading ? (
        <Loading />
      ) : data?.matches.length === 0 ? (
        <Empty icon="🎯" title="No matches at this threshold">
          Lower the filter, or wait for somebody to report the other side of your item.
        </Empty>
      ) : (
        <div className="stack">
          {(data?.matches ?? []).map((match) => (
            <MatchCard key={match.match_id} match={match} currentUserId={user.user_id} />
          ))}
        </div>
      )}
    </div>
  );
}
