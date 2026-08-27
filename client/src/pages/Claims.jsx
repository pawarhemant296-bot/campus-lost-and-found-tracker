import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import {
  Button,
  Card,
  Empty,
  ItemThumb,
  LoadingBlock,
  StatusBadge,
  Tag,
  ToggleGroup,
} from '../components/ui.jsx';
import { ClaimsAPI } from '../lib/api.js';
import { timeAgo } from '../lib/format.js';

const STAGE_TONE = {
  submitted: 'claim_requested',
  verification: 'verification',
  review: 'verification',
  handover: 'possible_match',
  returned: 'returned',
  rejected: 'closed',
};

export default function Claims() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('');

  useEffect(() => {
    ClaimsAPI.list()
      .then((d) => setClaims(d.claims || []))
      .catch(() => setClaims([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => (role ? claims.filter((c) => c.role === role) : claims),
    [claims, role]
  );

  const needsMe = claims.filter(
    (c) => (c.role === 'reporter' && c.stage === 'review') || (c.role === 'claimant' && c.stage === 'submitted')
  );

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow mb-2">Claims &amp; verification</div>
          <h1>Ownership cases</h1>
          <p>
            Every claim runs through the same wizard: submitted · verification · review · handover ·
            returned.
          </p>
        </div>
        <ToggleGroup
          value={role}
          onChange={setRole}
          options={[
            { value: '', label: 'All' },
            { value: 'claimant', label: 'I claimed', icon: 'user' },
            { value: 'reporter', label: 'On my items', icon: 'shield' },
          ]}
        />
      </div>

      {needsMe.length > 0 && (
        <Card glow className="card-pad mb-6 row-between row-wrap">
          <div className="row gap-3">
            <span className="stat-icon">
              <Icon name="alert" size={19} />
            </span>
            <div>
              <div className="strong">
                {needsMe.length} case{needsMe.length === 1 ? '' : 's'} waiting on you
              </div>
              <div className="tiny muted">
                Either answer the verification questions or review someone else's answers.
              </div>
            </div>
          </div>
          <Button to={`/app/claims/${needsMe[0].id}`} iconRight="arrowRight">
            Continue
          </Button>
        </Card>
      )}

      {loading ? (
        <Card className="card-pad">
          <LoadingBlock rows={4} />
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="card-pad">
          <Empty
            icon="shield"
            title="No claims yet"
            message="When you claim a found item — or someone claims an item you reported — the case appears here."
            action={
              <Button to="/app/matches" variant="ghost" iconRight="arrowRight">
                Check possible matches
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="col gap-4">
          {filtered.map((c) => (
            <Card key={c.id} hover className="card-pad">
              <div className="row gap-4 row-wrap">
                <ItemThumb item={{ image_url: c.item_image, title: c.item_title }} size={58} />
                <div className="grow" style={{ minWidth: 200 }}>
                  <div className="row gap-2 row-wrap">
                    <Tag icon="shield">Claim #{c.id}</Tag>
                    <span className={`badge badge-${STAGE_TONE[c.stage] || 'reported'}`}>{c.stage}</span>
                    {c.answer_score != null && (
                      <Tag icon="target">Auto-score {Math.round(c.answer_score)}%</Tag>
                    )}
                    {c.open_disputes > 0 && <span className="badge badge-claim_requested">disputed</span>}
                  </div>
                  <Link to={`/app/claims/${c.id}`} className="small strong mt-2" style={{ display: 'block', color: 'inherit' }}>
                    {c.item_title}
                  </Link>
                  <div className="tiny muted">
                    {c.role === 'claimant'
                      ? `You claimed this ${c.item_type} report`
                      : `Claimed by ${c.claimant_name}`}{' '}
                    · updated {timeAgo(c.updated_at)}
                  </div>
                </div>
                <div className="col gap-2" style={{ alignItems: 'flex-end' }}>
                  <StatusBadge status={c.item_status} />
                  <Button to={`/app/claims/${c.id}`} size="sm" variant="ghost" iconRight="arrowRight">
                    Open case
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
