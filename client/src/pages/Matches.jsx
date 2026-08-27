import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import {
  Alert,
  Button,
  Card,
  Empty,
  FactorBars,
  ItemThumb,
  LoadingBlock,
  MatchRing,
  PillSelect,
  StatusBadge,
  Tag,
  useToast,
} from '../components/ui.jsx';
import { ClaimsAPI, MatchesAPI, MessagesAPI } from '../lib/api.js';
import { formatDate, timeAgo } from '../lib/format.js';

const SCORES = [
  { value: '90', label: '90%+ · near certain' },
  { value: '80', label: '80%+ · strong' },
  { value: '65', label: '65%+ · likely' },
];

function MatchSide({ item, label }) {
  return (
    <div className="match-side">
      <ItemThumb item={item} size={58} />
      <div style={{ minWidth: 0 }}>
        <div className="tiny faint">{label}</div>
        <Link to={`/items/${item?.id}`} className="small strong truncate" style={{ display: 'block', color: 'inherit' }}>
          {item?.title}
        </Link>
        <div className="tiny muted truncate">
          {item?.location || 'Unknown place'} · {formatDate(item?.item_date)}
        </div>
        <div className="row gap-2 mt-2">
          <StatusBadge status={item?.status} />
        </div>
      </div>
    </div>
  );
}

export default function Matches() {
  const toast = useToast();
  const navigate = useNavigate();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [minScore, setMinScore] = useState('');
  const [sort, setSort] = useState('score');
  const [open, setOpen] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    MatchesAPI.list({ min_score: minScore || 0, sort: sort === 'score' ? 'score' : 'oldest' })
      .then((d) => setMatches(d.matches || []))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, [minScore, sort]);

  useEffect(load, [load]);

  const startClaim = async (match) => {
    // You claim the report filed by the *other* party.
    const target = match.lost_item?.reporter?.is_you ? match.found_item : match.lost_item;
    try {
      const { claim } = await ClaimsAPI.create({ item_id: target.id, match_id: match.id });
      toast.success('Claim opened — answer the verification questions next');
      navigate(`/app/claims/${claim.id}`);
    } catch (err) {
      if (err.status === 409 && err.payload?.claim) navigate(`/app/claims/${err.payload.claim.id}`);
      else toast.error(err.message);
    }
  };

  const dismiss = async (match) => {
    try {
      await MatchesAPI.reject(match.id);
      toast.success('Match dismissed — the other party has been informed');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const chat = async (match) => {
    const target = match.lost_item?.reporter?.is_you ? match.found_item : match.lost_item;
    try {
      const { user_id, item_id } = await MessagesAPI.start(target.id);
      navigate(`/app/messages?user=${user_id}&item=${item_id}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow mb-2">Possible matches</div>
          <h1>
            Pairs the engine <span className="gradient-text">traced back</span>
          </h1>
          <p>
            Each card pairs a lost report with a found report. The ring shows the combined confidence —
            expand a card to see the factor-by-factor breakdown.
          </p>
        </div>
      </div>

      <Card className="filter-bar mb-6">
        <PillSelect
          placeholder="Any score"
          value={minScore}
          onChange={setMinScore}
          options={SCORES}
          ariaLabel="Minimum match score"
        />
        <PillSelect
          placeholder="Sort by score"
          value={sort === 'score' ? '' : sort}
          onChange={(v) => setSort(v || 'score')}
          options={[{ value: 'oldest', label: 'Oldest first' }]}
        />
        <span className="ml-auto small muted">
          {loading ? 'Scanning…' : `${matches.length} pair${matches.length === 1 ? '' : 's'}`}
        </span>
      </Card>

      {loading ? (
        <Card className="card-pad">
          <LoadingBlock rows={4} />
        </Card>
      ) : matches.length === 0 ? (
        <Card className="card-pad">
          <Empty
            icon="radar"
            title="No possible matches yet"
            message="The engine re-runs every time a new report is filed. Add a photo and a richer description to your reports to raise the odds."
            action={
              <Button to="/app/reports" variant="ghost" iconRight="arrowRight">
                Review my reports
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="col gap-4">
          {matches.map((m) => {
            const mineIsLost = Boolean(m.lost_item?.reporter?.is_you);
            const target = mineIsLost ? m.found_item : m.lost_item;
            const canClaim =
              m.perspective !== 'admin' &&
              m.status !== 'confirmed' &&
              !['returned', 'closed'].includes(target?.status || '');
            const expanded = open === m.id;

            return (
              <Card key={m.id} glow={m.match_score >= 85}>
                <div className="card-body">
                  <div className="row-between mb-4 row-wrap">
                    <div className="row gap-2 row-wrap">
                      <Tag icon="target">Pair #{m.id}</Tag>
                      <Tag icon="clock">{timeAgo(m.created_at)}</Tag>
                      {m.status !== 'pending' && (
                        <span className={`badge badge-${m.status === 'confirmed' ? 'returned' : m.status === 'rejected' ? 'closed' : 'claim_requested'}`}>
                          {m.status}
                        </span>
                      )}
                      {m.match_score >= 85 && <span className="badge badge-possible_match">Strong match</span>}
                    </div>
                    <div className="tiny faint">
                      you are the {m.perspective === 'owner' ? 'owner' : m.perspective === 'finder' ? 'finder' : 'moderator'}
                    </div>
                  </div>

                  <div className="match-pair">
                    <MatchSide item={m.lost_item} label={m.lost_item?.reporter?.is_you ? 'Your lost report' : 'Lost report'} />
                    <div className="match-link">
                      <MatchRing score={m.match_score} size={104} stroke={8} caption="Match" pulse={m.match_score >= 85} />
                    </div>
                    <MatchSide item={m.found_item} label={m.found_item?.reporter?.is_you ? 'Your found report' : 'Found report'} />
                  </div>

                  {expanded && (
                    <div className="mt-6 col gap-5">
                      <div className="divider" />
                      <div className="grid grid-2" style={{ gap: 'var(--s-6)' }}>
                        <div>
                          <div className="eyebrow mb-3">Score breakdown</div>
                          <FactorBars factors={m.breakdown?.factors || []} />
                        </div>
                        <div>
                          <div className="eyebrow mb-3">Why it matched</div>
                          <div className="col gap-2">
                            {(m.breakdown?.reasons || []).map((r) => (
                              <div className="row gap-2 small soft" key={r}>
                                <Icon name="check" size={14} style={{ color: 'var(--violet-300)', flex: '0 0 auto' }} />
                                {r}
                              </div>
                            ))}
                          </div>
                          {!mineIsLost && (
                            <Alert tone="warn" icon="shield">
                              You reported the found item. The owner submits the claim — you'll review
                              their verification answers.
                            </Alert>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="divider mt-6" />
                  <div className="row gap-3 row-wrap mt-4">
                    <Button
                      variant="subtle"
                      size="sm"
                      icon={expanded ? 'chevronDown' : 'chevronRight'}
                      onClick={() => setOpen(expanded ? null : m.id)}
                    >
                      {expanded ? 'Hide breakdown' : 'View details'}
                    </Button>
                    <Button to={`/items/${target?.id}`} variant="ghost" size="sm" icon="eye">
                      Open {mineIsLost ? 'found' : 'lost'} report
                    </Button>
                    <Button variant="ghost" size="sm" icon="message" onClick={() => chat(m)}>
                      Message
                    </Button>
                    <div className="ml-auto row gap-2">
                      {m.status !== 'rejected' && (
                        <Button variant="subtle" size="sm" icon="x" onClick={() => dismiss(m)}>
                          Not my item
                        </Button>
                      )}
                      {mineIsLost && canClaim && (
                        <Button size="sm" iconRight="arrowRight" onClick={() => startClaim(m)}>
                          Start Claim
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
