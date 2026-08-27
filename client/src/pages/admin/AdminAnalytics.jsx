import { useEffect, useState } from 'react';
import { Card, CardHead, Empty, LoadingBlock, StatCard } from '../../components/ui.jsx';
import { BarChart, DonutChart, LineChart } from '../../components/charts.jsx';
import { AdminAPI } from '../../lib/api.js';
import { STATUS_LABELS } from '../../lib/format.js';

export default function AdminAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AdminAPI.analytics()
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
  if (!data) return <Empty icon="pie" title="Analytics unavailable" />;

  const {
    reports_over_time: overTime = [],
    category_breakdown: categories = [],
    location_hotspots: hotspots = [],
    status_funnel: funnel = [],
    score_buckets: buckets = [],
    resolution_trend: resolution = [],
    rates = {},
  } = data;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow mb-2">Analytics</div>
          <h1>
            How well is TraceBack <span className="gradient-text">performing?</span>
          </h1>
          <p>Reporting volume, match quality, category mix and resolution speed.</p>
        </div>
      </div>

      <div className="grid grid-3 mb-6">
        <StatCard icon="target" label="Match success rate" value={`${rates.match_success_rate || 0}%`} hint="confirmed ÷ generated" />
        <StatCard icon="shield" label="Claim approval rate" value={`${rates.claim_approval_rate || 0}%`} hint="approved ÷ submitted" />
        <StatCard
          icon="clock"
          label="Avg resolution time"
          value={`${rates.avg_resolution_hours || 0}h`}
          hint="claim opened to closed"
        />
      </div>

      <Card className="mb-6">
        <CardHead title="Reports over time" subtitle="Last 30 days · lost vs found" icon="chart" />
        <div className="card-body">
          <LineChart
            data={overTime}
            height={250}
            series={[
              { key: 'lost', label: 'Lost reports', color: '#c084fc' },
              { key: 'found', label: 'Found reports', color: '#7dd3fc' },
            ]}
          />
        </div>
      </Card>

      <div className="grid grid-2 mb-6">
        <Card>
          <CardHead title="Category breakdown" subtitle="What goes missing most" icon="pie" />
          <div className="card-body">
            <DonutChart data={categories} centerLabel="Reports" />
          </div>
        </Card>

        <Card>
          <CardHead title="Match score distribution" subtitle="Confidence of generated pairs" icon="target" />
          <div className="card-body">
            <BarChart data={buckets} height={236} />
          </div>
        </Card>
      </div>

      <div className="grid grid-2 mb-6">
        <Card>
          <CardHead title="Location hotspots" subtitle="Where items are lost and found" icon="pin" />
          <div className="card-body">
            <BarChart data={hotspots} horizontal />
          </div>
        </Card>

        <Card>
          <CardHead title="Lifecycle funnel" subtitle="Items by current status" icon="list" />
          <div className="card-body">
            <BarChart
              data={funnel.map((f) => ({ ...f, label: STATUS_LABELS[f.label] || f.label }))}
              horizontal
            />
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title="Resolution time trend" subtitle="Hours from claim opened to closed" icon="clock" />
        <div className="card-body">
          <LineChart
            data={resolution}
            height={220}
            series={[{ key: 'hours', label: 'Avg hours to resolve', color: '#a855f7' }]}
          />
        </div>
      </Card>
    </>
  );
}
