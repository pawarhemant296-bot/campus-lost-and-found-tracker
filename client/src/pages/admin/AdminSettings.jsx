import { useEffect, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import {
  Alert,
  Button,
  Card,
  CardHead,
  Field,
  LoadingBlock,
  Switch,
  useToast,
} from '../../components/ui.jsx';
import { DonutChart } from '../../components/charts.jsx';
import { AdminAPI } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';

const WEIGHTS = [
  { key: 'weight_category', label: 'Item & category similarity', icon: 'tag' },
  { key: 'weight_description', label: 'Description similarity', icon: 'list' },
  { key: 'weight_location', label: 'Location similarity', icon: 'pin' },
  { key: 'weight_date', label: 'Date & time proximity', icon: 'clock' },
  { key: 'weight_image', label: 'Image similarity', icon: 'camera' },
];

export default function AdminSettings() {
  const toast = useToast();
  const { reloadMeta, meta } = useAuth();
  const [settings, setSettings] = useState(null);
  const [defaults, setDefaults] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    AdminAPI.settings()
      .then((d) => {
        setSettings(d.settings);
        setDefaults(d.defaults);
      })
      .catch(() => {});
  }, []);

  if (!settings) {
    return (
      <Card className="card-pad">
        <LoadingBlock rows={5} />
      </Card>
    );
  }

  const total = WEIGHTS.reduce((s, w) => s + Number(settings[w.key] || 0), 0);
  const set = (k, v) => setSettings({ ...settings, [k]: v });

  const save = async () => {
    setBusy(true);
    try {
      const { settings: saved } = await AdminAPI.saveSettings(settings);
      setSettings(saved);
      await reloadMeta();
      toast.success('Matching engine updated — new reports use these weights immediately');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow mb-2">Settings</div>
          <h1>Matching engine tuning</h1>
          <p>
            These weights are applied live by the engine. Weights are re-normalised automatically, so
            they don't have to sum to 100.
          </p>
        </div>
        <div className="row gap-3">
          <Button variant="subtle" icon="refresh" onClick={() => setSettings({ ...defaults })}>
            Reset to defaults
          </Button>
          <Button loading={busy} icon="check" onClick={save}>
            Save settings
          </Button>
        </div>
      </div>

      <div className="detail-grid">
        <div className="col gap-6">
          <Card>
            <CardHead title="Factor weights" subtitle={`Currently summing to ${total}`} icon="sliders" />
            <div className="card-body col gap-6">
              {total !== 100 && (
                <Alert tone="warn">
                  Weights sum to {total}, not 100. The engine will re-normalise them proportionally —
                  scores stay comparable either way.
                </Alert>
              )}
              {WEIGHTS.map((w) => (
                <Field key={w.key} label={w.label}>
                  <div className="row gap-4">
                    <span className="stat-icon" style={{ width: 36, height: 36 }}>
                      <Icon name={w.icon} size={16} />
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={settings[w.key]}
                      onChange={(e) => set(w.key, Number(e.target.value))}
                      style={{ flex: 1, accentColor: 'var(--violet-400)' }}
                    />
                    <span className="mono strong" style={{ minWidth: 46, textAlign: 'right' }}>
                      {settings[w.key]}%
                    </span>
                  </div>
                </Field>
              ))}
            </div>
          </Card>

          <Card>
            <CardHead title="Thresholds & behaviour" icon="target" />
            <div className="card-body col gap-6">
              <Field
                label="Match threshold"
                hint="Pairs scoring below this are discarded and never shown to users."
              >
                <div className="row gap-4">
                  <input
                    type="range"
                    min="20"
                    max="95"
                    value={settings.match_threshold}
                    onChange={(e) => set('match_threshold', Number(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--violet-400)' }}
                  />
                  <span className="mono strong" style={{ minWidth: 46, textAlign: 'right' }}>
                    {settings.match_threshold}%
                  </span>
                </div>
              </Field>

              <Field label="Strong match threshold" hint="Above this, notifications read “Strong match found”.">
                <div className="row gap-4">
                  <input
                    type="range"
                    min="50"
                    max="99"
                    value={settings.strong_match_threshold}
                    onChange={(e) => set('strong_match_threshold', Number(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--violet-400)' }}
                  />
                  <span className="mono strong" style={{ minWidth: 46, textAlign: 'right' }}>
                    {settings.strong_match_threshold}%
                  </span>
                </div>
              </Field>

              <Field
                label="Date proximity window"
                hint="Reports further apart than this score 0 on the date factor."
              >
                <div className="row gap-4">
                  <input
                    type="range"
                    min="1"
                    max="60"
                    value={settings.date_window_days}
                    onChange={(e) => set('date_window_days', Number(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--violet-400)' }}
                  />
                  <span className="mono strong" style={{ minWidth: 60, textAlign: 'right' }}>
                    {settings.date_window_days}d
                  </span>
                </div>
              </Field>

              <Switch
                checked={Boolean(settings.auto_notify)}
                onChange={(v) => set('auto_notify', v ? 1 : 0)}
                label="Auto-notify both parties on a new match"
                hint="Turn off during demos if you don't want notification spam."
              />
            </div>
          </Card>
        </div>

        <div className="col gap-6 sticky-side">
          <Card>
            <CardHead title="Weight distribution" subtitle="Effective share per factor" icon="pie" />
            <div className="card-body">
              <DonutChart
                data={WEIGHTS.map((w) => ({ label: w.label, value: Number(settings[w.key] || 0) }))}
                size={190}
                centerLabel="Total"
                centerValue={`${total}`}
              />
            </div>
          </Card>

          <Card>
            <CardHead title="Engine status" icon="sparkle" />
            <div className="card-body col gap-3 small">
              <div className="row-between">
                <span className="soft">Image similarity (dHash)</span>
                <span className={`badge badge-${meta?.matching?.image_similarity_enabled ? 'returned' : 'closed'}`}>
                  {meta?.matching?.image_similarity_enabled ? 'enabled' : 'disabled'}
                </span>
              </div>
              <div className="row-between">
                <span className="soft">Live threshold</span>
                <span className="mono muted">{meta?.matching?.threshold}%</span>
              </div>
              <p className="tiny faint mt-2">
                Changing weights affects newly created matches and any report you re-scan. Existing
                stored scores are refreshed when an item is re-scanned from “My Reports”.
              </p>
            </div>
          </Card>

          <Alert icon="shield">
            The reference weights from the problem statement are 25 / 25 / 20 / 15 / 15 with a 45%
            threshold — the defaults you can restore at any time.
          </Alert>
        </div>
      </div>
    </>
  );
}
