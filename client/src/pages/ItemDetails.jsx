import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import {
  Alert,
  Avatar,
  Button,
  Card,
  CardHead,
  Empty,
  FactorBars,
  ItemThumb,
  LifecycleStepper,
  LoadingBlock,
  MatchRing,
  Modal,
  StatusBadge,
  Tag,
  Textarea,
  useToast,
} from '../components/ui.jsx';
import { ClaimsAPI, ItemsAPI, MessagesAPI } from '../lib/api.js';
import { formatDateTime, timeAgo } from '../lib/format.js';
import { useAuth } from '../lib/auth.jsx';

export default function ItemDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    ItemsAPI.get(id)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  if (loading) {
    return (
      <div className="container section-tight">
        <Card className="card-pad">
          <LoadingBlock rows={5} />
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container section">
        <Empty
          icon="radar"
          title="Item not found"
          message="This report may have been removed or hidden by a moderator."
          action={<Button to="/browse" iconRight="arrowRight">Back to browse</Button>}
        />
      </div>
    );
  }

  const { item, matches = [], verification_questions: questions = [], my_claim: myClaim } = data;
  const isOwner = item.reporter?.is_you;
  const best = matches.length
    ? matches.reduce((a, b) => (b.match_score > a.match_score ? b : a))
    : null;
  const counterpart =
    best && (best.lost_item?.id === item.id ? best.found_item : best.lost_item);
  const factors = best?.breakdown?.factors || [];

  const submitClaim = async () => {
    setBusy(true);
    try {
      const { claim } = await ClaimsAPI.create({
        item_id: item.id,
        match_id: best?.id || null,
        note,
      });
      toast.success('Claim submitted — answer the verification questions next');
      navigate(`/app/claims/${claim.id}`);
    } catch (err) {
      if (err.status === 409 && err.payload?.claim) {
        navigate(`/app/claims/${err.payload.claim.id}`);
      } else {
        toast.error(err.message);
      }
    } finally {
      setBusy(false);
      setClaiming(false);
    }
  };

  const startChat = async () => {
    try {
      const { user_id, item_id } = await MessagesAPI.start(item.id);
      navigate(`/app/messages?user=${user_id}&item=${item_id}`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="container section-tight">
      <div className="row-between mb-6 row-wrap">
        <Link to="/browse" className="row gap-2 small muted">
          <Icon name="arrowLeft" size={15} /> Back to all items
        </Link>
        <div className="row gap-2">
          <span className={`badge badge-${item.type}`}>{item.type === 'lost' ? 'Lost item' : 'Found item'}</span>
          <StatusBadge status={item.status} />
        </div>
      </div>

      <div className="detail-grid">
        {/* ------------------------------------------------------ left: photo */}
        <div className="col gap-6">
          <div className="photo-frame">
            {item.image_url ? (
              <img src={item.image_url} alt={item.title} />
            ) : (
              <div className="center" style={{ aspectRatio: '4/3', color: 'var(--text-faint)' }}>
                <div className="col gap-3 center">
                  <Icon name="box" size={44} strokeWidth={1.2} />
                  <span className="tiny">No photo attached</span>
                </div>
              </div>
            )}
          </div>

          <Card className="card-pad">
            <div className="eyebrow mb-4">Status lifecycle</div>
            <LifecycleStepper status={item.status} />
          </Card>

          {/* ------------------------------------------- match confidence */}
          {best && (
            <Card glow>
              <CardHead
                title="This might be your item?"
                subtitle={`Compared against ${matches.length} candidate${matches.length === 1 ? '' : 's'} by the matching engine`}
                icon="target"
              />
              <div className="card-body col gap-6">
                <div className="row gap-6 row-wrap">
                  <MatchRing score={best.match_score} size={148} pulse caption="Match" />
                  <div className="grow" style={{ minWidth: 230 }}>
                    <FactorBars factors={factors} />
                  </div>
                </div>

                {best.breakdown?.reasons?.length > 0 && (
                  <div className="col gap-2">
                    <span className="eyebrow">Why this matched</span>
                    {best.breakdown.reasons.map((r) => (
                      <div className="row gap-2 small soft" key={r}>
                        <Icon name="check" size={14} style={{ color: 'var(--violet-300)', flex: '0 0 auto' }} />
                        {r}
                      </div>
                    ))}
                  </div>
                )}

                {counterpart && (
                  <Link to={`/items/${counterpart.id}`}>
                    <Card hover className="card-pad-sm row gap-3">
                      <ItemThumb item={counterpart} size={58} />
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div className="tiny faint">
                          Paired {counterpart.type} report · {timeAgo(counterpart.created_at)}
                        </div>
                        <div className="small strong truncate">{counterpart.title}</div>
                        <div className="tiny muted truncate">
                          {counterpart.location} · {counterpart.reporter?.name}
                        </div>
                      </div>
                      <Icon name="chevronRight" size={16} className="muted" />
                    </Card>
                  </Link>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* --------------------------------------------------- right: details */}
        <div className="col gap-6 sticky-side">
          <Card className="card-pad">
            <h1 style={{ fontSize: '1.7rem' }}>{item.title}</h1>
            <div className="row gap-2 row-wrap mt-3">
              <Tag icon="tag">{item.category}</Tag>
              <Tag icon="pin">{item.location || 'Location unknown'}</Tag>
              <Tag icon="clock">{formatDateTime(item.item_date)}</Tag>
            </div>

            <p className="mt-6" style={{ whiteSpace: 'pre-line' }}>
              {item.description || 'No description provided.'}
            </p>

            <div className="divider" />

            <dl className="kv">
              <dt>Report type</dt>
              <dd className="strong" style={{ textTransform: 'capitalize' }}>{item.type}</dd>
              <dt>Reported</dt>
              <dd>{formatDateTime(item.created_at)}</dd>
              <dt>Last update</dt>
              <dd>{timeAgo(item.updated_at)}</dd>
              <dt>Reported by</dt>
              <dd>
                <span className="row gap-2">
                  <Avatar name={item.reporter?.name} hue={item.reporter?.hue} size="sm" />
                  <span>
                    <span className="strong">{item.reporter?.name}</span>
                    <span className="tiny faint" style={{ display: 'block' }}>
                      {isOwner ? 'That’s you' : 'Identity masked until a claim is approved'}
                    </span>
                  </span>
                </span>
              </dd>
            </dl>
          </Card>

          {/* --------------------------------------------------- actions */}
          <Card className="card-pad col gap-4">
            {!user ? (
              <>
                <Alert>Sign in to claim this item, message the reporter or track matches.</Alert>
                <Button to="/login" block iconRight="arrowRight">
                  Sign in to continue
                </Button>
              </>
            ) : isOwner ? (
              <>
                <Alert tone="success" icon="check">
                  This is your report. We'll notify you the moment a new opposite report scores above the
                  match threshold.
                </Alert>
                <div className="row gap-3">
                  <Button
                    variant="ghost"
                    icon="refresh"
                    className="grow"
                    onClick={async () => {
                      const res = await ItemsAPI.rescan(item.id);
                      toast.success(`Re-scan complete · ${res.match_count} match${res.match_count === 1 ? '' : 'es'} found`);
                      load();
                    }}
                  >
                    Re-scan for matches
                  </Button>
                  <Button to="/app/reports" variant="subtle" icon="list">
                    My reports
                  </Button>
                </div>
              </>
            ) : myClaim ? (
              <>
                <Alert tone="warn" icon="shield">
                  You already have a claim on this item (stage: <strong>{myClaim.stage}</strong>).
                </Alert>
                <Button to={`/app/claims/${myClaim.id}`} block iconRight="arrowRight">
                  Open my claim
                </Button>
              </>
            ) : ['returned', 'closed'].includes(item.status) ? (
              <Alert tone="success" icon="check">
                This case is already closed — the item has been returned to its owner.
              </Alert>
            ) : (
              <>
                <div>
                  <div className="eyebrow mb-2">Is this yours?</div>
                  <p className="small">
                    Submitting a claim starts the verification flow. You'll answer
                    {questions.length ? ` ${questions.length} private question${questions.length === 1 ? '' : 's'} ` : ' a few questions '}
                    that only the real owner could know.
                  </p>
                </div>
                {questions.length > 0 && (
                  <ul className="col gap-2">
                    {questions.map((q, i) => (
                      <li key={i} className="row gap-2 tiny muted">
                        <Icon name="lock" size={12} style={{ flex: '0 0 auto', marginTop: 3 }} />
                        {q}
                      </li>
                    ))}
                  </ul>
                )}
                <Button block iconRight="arrowRight" onClick={() => setClaiming(true)}>
                  Claim This Item
                </Button>
                <Button variant="ghost" block icon="message" onClick={startChat}>
                  Message the reporter
                </Button>
              </>
            )}
          </Card>

          {matches.length > 1 && (
            <Card>
              <CardHead title="Other candidates" subtitle={`${matches.length - 1} more pair(s)`} icon="link" />
              <div className="card-body col gap-3">
                {matches
                  .filter((m) => m.id !== best.id)
                  .map((m) => {
                    const other = m.lost_item?.id === item.id ? m.found_item : m.lost_item;
                    return (
                      <Link key={m.id} to={`/items/${other?.id}`} className="row gap-3">
                        <MatchRing score={m.match_score} size={54} stroke={5} caption="" />
                        <div className="grow" style={{ minWidth: 0 }}>
                          <div className="small strong truncate">{other?.title}</div>
                          <div className="tiny muted truncate">{other?.location}</div>
                        </div>
                        <Icon name="chevronRight" size={15} className="muted" />
                      </Link>
                    );
                  })}
              </div>
            </Card>
          )}
        </div>
      </div>

      {claiming && (
        <Modal
          title="Start a claim"
          onClose={() => setClaiming(false)}
          footer={
            <div className="row gap-3 ml-auto">
              <Button variant="subtle" onClick={() => setClaiming(false)}>
                Cancel
              </Button>
              <Button loading={busy} onClick={submitClaim} iconRight="arrowRight">
                Submit claim
              </Button>
            </div>
          }
        >
          <div className="col gap-4">
            <Alert icon="shield">
              Your identity stays masked. The finder only sees your verification answers until they
              approve the claim.
            </Alert>
            <div className="row gap-3">
              <ItemThumb item={item} size={58} />
              <div>
                <div className="small strong">{item.title}</div>
                <div className="tiny muted">
                  {item.category} · {item.location}
                </div>
              </div>
            </div>
            <Textarea
              rows={4}
              placeholder="Optional: briefly explain why this is yours (when and where you lost it)…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <p className="tiny faint">
              Next step: you'll answer the private ownership questions, then the finder or an admin
              reviews your claim.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
