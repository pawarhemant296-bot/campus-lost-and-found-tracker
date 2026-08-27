import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import {
  Alert,
  Button,
  Card,
  CardHead,
  Empty,
  ItemThumb,
  LoadingBlock,
  MatchRing,
  StatCard,
  StatusBadge,
} from '../components/ui.jsx';
import { ClaimsAPI, ItemsAPI, MatchesAPI } from '../lib/api.js';
import { formatDate, timeAgo } from '../lib/format.js';
import { useAuth } from '../lib/auth.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [matches, setMatches] = useState([]);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([
      ItemsAPI.list({ mine: 1, limit: 100 }),
      MatchesAPI.list(),
      ClaimsAPI.list(),
    ])
      .then(([i, m, c]) => {
        if (!alive) return;
        setItems(i.items || []);
        setMatches(m.matches || []);
        setClaims(c.claims || []);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const stats = useMemo(() => {
    const lost = items.filter((i) => i.type === 'lost').length;
    const found = items.filter((i) => i.type === 'found').length;
    const returned = items.filter((i) => ['returned', 'closed'].includes(i.status)).length;
    const active = matches.filter((m) => !['rejected'].includes(m.status)).length;
    return { lost, found, returned, active };
  }, [items, matches]);

  const activity = useMemo(
    () => [...items].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)).slice(0, 6),
    [items]
  );

  const topMatches = useMemo(
    () => [...matches].sort((a, b) => b.match_score - a.match_score).slice(0, 3),
    [matches]
  );

  const openClaims = claims.filter((c) => c.status === 'open');
  const actionable = claims.filter((c) => c.role === 'reporter' && c.stage === 'review');

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow mb-2">Dashboard</div>
          <h1>
            Welcome back, <span className="gradient-text">{user?.name?.split(' ')[0]}</span>
          </h1>
          <p>Here's the current state of everything you've reported and every match we've traced.</p>
        </div>
        <div className="row gap-3">
          <Button to="/app/report/found" variant="ghost" icon="box">
            Report Found
          </Button>
          <Button to="/app/report/lost" icon="search">
            Report Lost
          </Button>
        </div>
      </div>

      {actionable.length > 0 && (
        <div className="mb-6">
          <Alert tone="warn" icon="shield">
            <strong>{actionable.length} claim{actionable.length === 1 ? '' : 's'} awaiting your review.</strong>{' '}
            Someone answered the ownership questions on an item you reported found.{' '}
            <Link to={`/app/claims/${actionable[0].id}`}>Review now</Link>
          </Alert>
        </div>
      )}

      {/* ---------------------------------------------------------- stats */}
      <div className="grid grid-4">
        <StatCard icon="search" label="Lost Items Reported" value={stats.lost} to="/app/reports" />
        <StatCard icon="box" label="Found Items Reported" value={stats.found} to="/app/reports" />
        <StatCard
          icon="target"
          label="Active Matches"
          value={stats.active}
          to="/app/matches"
          hint={topMatches[0] ? `Best ${Math.round(topMatches[0].match_score)}%` : undefined}
        />
        <StatCard icon="handshake" label="Items Returned" value={stats.returned} to="/app/reports" />
      </div>

      <div
        className="grid mt-6"
        style={{ gridTemplateColumns: 'minmax(0,1.15fr) minmax(0,0.85fr)', gap: 'var(--s-6)' }}
      >
        {/* ------------------------------------------------ recent activity */}
        <Card>
          <CardHead
            title="Recent activity"
            subtitle="Your latest reports and their status"
            icon="list"
            action={
              <Button to="/app/reports" variant="subtle" size="sm" iconRight="chevronRight">
                All reports
              </Button>
            }
          />
          <div className="card-body">
            {loading ? (
              <LoadingBlock rows={4} />
            ) : activity.length === 0 ? (
              <Empty
                icon="box"
                title="No reports yet"
                message="File your first lost or found report and the matching engine starts working immediately."
                action={
                  <Button to="/app/report/lost" iconRight="arrowRight">
                    Report an item
                  </Button>
                }
              />
            ) : (
              <div className="col gap-3">
                {activity.map((it) => (
                  <Link key={it.id} to={`/items/${it.id}`} className="row gap-3">
                    <ItemThumb item={it} size={58} />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row gap-2">
                        <span className={`badge badge-${it.type} badge-plain`}>{it.type}</span>
                        <span className="tiny faint">{formatDate(it.item_date)}</span>
                      </div>
                      <div className="small strong truncate mt-2">{it.title}</div>
                      <div className="tiny muted truncate">
                        {it.category} · {it.location || 'Unknown place'}
                      </div>
                    </div>
                    <div className="col gap-2" style={{ alignItems: 'flex-end' }}>
                      <StatusBadge status={it.status} />
                      <span className="tiny faint">{timeAgo(it.updated_at)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* ------------------------------------------------ possible matches */}
        <div className="col gap-6">
          <Card>
            <CardHead
              title="Possible matches"
              subtitle="Ranked by confidence"
              icon="target"
              action={
                <Button to="/app/matches" variant="subtle" size="sm" iconRight="chevronRight">
                  View all
                </Button>
              }
            />
            <div className="card-body">
              {loading ? (
                <LoadingBlock rows={3} />
              ) : topMatches.length === 0 ? (
                <Empty
                  icon="radar"
                  title="No matches yet"
                  message="We're still scanning. You'll get a notification the moment something scores above the threshold."
                />
              ) : (
                <div className="col gap-4">
                  {topMatches.map((m) => {
                    const mine = m.lost_item?.reporter?.is_you ? m.lost_item : m.found_item;
                    const other = mine?.id === m.lost_item?.id ? m.found_item : m.lost_item;
                    return (
                      <Link key={m.id} to="/app/matches" className="row gap-4">
                        <MatchRing score={m.match_score} size={74} stroke={7} caption="" />
                        <div className="grow" style={{ minWidth: 0 }}>
                          <div className="tiny faint">
                            your {mine?.type} report · their {other?.type} report
                          </div>
                          <div className="small strong truncate">{other?.title}</div>
                          <div className="tiny muted truncate">
                            {other?.location} · {timeAgo(m.created_at)}
                          </div>
                        </div>
                        <Icon name="chevronRight" size={16} className="muted" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHead title="Claims in flight" subtitle={`${openClaims.length} open`} icon="shield" />
            <div className="card-body">
              {claims.length === 0 ? (
                <p className="small muted">
                  No claims yet. When you claim a found item — or someone claims yours — it appears here
                  with its verification progress.
                </p>
              ) : (
                <div className="col gap-3">
                  {claims.slice(0, 4).map((c) => (
                    <Link key={c.id} to={`/app/claims/${c.id}`} className="row gap-3">
                      <span className="stat-icon" style={{ width: 38, height: 38 }}>
                        <Icon name={c.role === 'claimant' ? 'user' : 'shield'} size={16} />
                      </span>
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div className="small strong truncate">{c.item_title}</div>
                        <div className="tiny muted">
                          {c.role === 'claimant' ? 'You claimed this' : `Claimed by ${c.claimant_name}`} ·{' '}
                          {timeAgo(c.updated_at)}
                        </div>
                      </div>
                      <span className={`badge badge-${c.status === 'approved' ? 'returned' : c.status === 'rejected' ? 'closed' : 'verification'}`}>
                        {c.stage}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
