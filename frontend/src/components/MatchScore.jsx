import { scoreColor, scoreLabel } from '../utils/format.js';

/** Circular score gauge. */
export function ScoreRing({ score, size = 68 }) {
  const value = Math.round(Number(score) || 0);
  return (
    <div
      className="score-ring"
      style={{ '--pct': value, '--ring-color': scoreColor(value), '--size': `${size}px` }}
      title={`${value}% - ${scoreLabel(value)}`}
    >
      <span>{value}%</span>
    </div>
  );
}

/**
 * "Why did this match?" panel - shows each weighted factor from the engine,
 * including the ones that were skipped and had their weight redistributed.
 */
export function MatchBreakdown({ breakdown }) {
  if (!breakdown?.factors?.length) {
    return <p className="muted small">No score breakdown stored for this match.</p>;
  }
  return (
    <div>
      {breakdown.factors.map((factor) => (
        <div className="factor-row" key={factor.key}>
          <div>
            <div className="factor-name">
              {factor.label} <span className="muted tiny">· weight {factor.weight_pct}%</span>
            </div>
            <div className="factor-reason">{factor.reason}</div>
          </div>
          <div className="factor-value">{factor.skipped ? '—' : `${factor.score_pct}%`}</div>
          <div className={`bar${factor.skipped ? ' skipped' : ''}`}>
            <div style={{ width: `${factor.skipped ? 0 : factor.score_pct}%` }} />
          </div>
        </div>
      ))}
      <p className="muted tiny" style={{ marginTop: 10 }}>
        Skipped factors have their weight redistributed across the remaining ones, so a missing photo cannot cap an
        otherwise perfect match.
        {breakdown.ai_used ? ' Semantic AI scoring was used for this pair.' : ''}
      </p>
    </div>
  );
}

export default ScoreRing;
