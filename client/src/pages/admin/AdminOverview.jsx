import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import {
  Button,
  Card,
  CardHead,
  Empty,
  LoadingBlock,
  StatCard,
  StatusBadge,
} from '../../components/ui.jsx';
import { LineChart, Sparkline } from '../../components/charts.jsx';
import { AdminAPI } from '../../lib/api.js';
import { timeAgo } from '../../lib/format.js';

export default function AdminOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AdminAPI.overview()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="card-pad">
        <LoadingBlock rows={6} />
      </Card>
    );
  }
  if (!data) return <Empty icon="alert" title="Could not load the console" />;

  const { kpis, reports_by_day: byDay = [], recent_items: recent = [], claim_queue: queue = [] } = data;
  const spark = byDay.map((d) => (d.lost || 0) + (d.found || 0));

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow mb-2">Admin console</div>
          <h1>
            Network <span className="gradient-text">overview</span>
          </h1>
          <p>Moderation queue, KPIs and the last 14 days of reporting activity.</p>
        </div>
        <div className="row gap-3">
          <Button to="/admin/analytics" variant="ghost" icon="pie">
            Analytics
          </Button>
          <Button to="/admin/claims" icon="shield">
            Review claims
          </Button>
        </div>
      </div>

      <div className="grid grid-4">
        <StatCard
          icon="box"
          label="Total Reports"
          value={kpis.total_reports}
          hint={`${kpis.lost_reports} lost · ${kpis.found_reports} found`}
          to="/admin/items"
        />
        <StatCard
          icon="shield"
          label="Pending Claims"
          value={kpis.pending_claims}
          hint={kpis.open_disputes ? `${kpis.open_disputes} disputed` : 'no disputes'}
          to="/admin/claims"
        />
        <StatCard icon="handshake" label="Resolved Cases" value={kpis.resolved_cases} to="/admin/items" />
        <StatCard icon="users" label="Active Users" value={kpis.active_users} to="/admin/users" />
      </div>

      <div className="grid grid-3 mt-6">
        <Card className="card-pad row-between">
          <div>
            <div className="stat-label">Match pairs generated</div>
            <div className="stat-value">{kpis.total_matches}</div>
          </div>
          <Sparkline values={spark.length > 1 ? spark : [0, 0]} />
        </Card>
        <Card className="card-pad row-between">
          <div>
            <div className="stat-label">Flagged / hidden items</div>
            <div className="stat-value">{kpis.flagged_items}</div>
          </div>
          <span className="stat-icon">
            <Icon name="flag" size={19} />
          </span>
        </Card>
        <Card className="card-pad row-between">
          <div>
            <div className="stat-label">Open disputes</div>
            <div className="stat-value">{kpis.open_disputes}</div>
          </div>
          <Button to="/admin/disputes" size="sm" variant="ghost" iconRight="arrowRight">
            Resolve
          </Button>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHead title="Reports over the last 14 days" subtitle="Lost vs found volume" icon="chart" />
        <div className="card-body">
          <LineChart
            data={byDay}
            series={[
              { key: 'lost', label: 'Lost reports', color: '#c084fc' },
              { key: 'found', label: 'Found reports', color: '#7dd3fc' },
            ]}
          />
        </div>
      </Card>

      <div className="grid grid-2 mt-6">
        <Card>
          <CardHead
            title="Moderation queue"
            subtitle={`${queue.length} open claim(s)`}
            icon="scale"
            action={
              <Button to="/admin/claims" size="sm" variant="subtle" iconRight="chevronRight">
                All claims
              </Button>
            }
          />
          <div className="card-body">
            {queue.length === 0 ? (
              <p className="small muted">Nothing waiting — every claim has been decided.</p>
            ) : (
              <div className="col gap-3">
                {queue.map((c) => (
                  <Link key={c.id} to="/admin/claims" className="row gap-3">
                    <span className="stat-icon" style={{ width: 38, height: 38 }}>
                      <Icon name="shield" size={16} />
                    </span>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="small strong truncate">{c.item_title}</div>
                      <div className="tiny muted">
                        {c.claimant} · {c.stage}
                        {c.answer_score != null && ` · auto ${Math.round(c.answer_score)}%`}
                      </div>
                    </div>
                    <span className="tiny faint">{timeAgo(c.created_at)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHead
            title="Latest reports"
            icon="list"
            action={
              <Button to="/admin/items" size="sm" variant="subtle" iconRight="chevronRight">
                Manage items
              </Button>
            }
          />
          <div className="card-body">
            <div className="col gap-3">
              {recent.map((it) => (
                <Link key={it.id} to={`/items/${it.id}`} className="row gap-3">
                  <span className={`badge badge-${it.type} badge-plain`}>{it.type}</span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="small strong truncate">{it.title}</div>
                    <div className="tiny muted truncate">
                      {it.category} · {it.reporter}
                    </div>
                  </div>
                  <StatusBadge status={it.status} />
                </Link>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
