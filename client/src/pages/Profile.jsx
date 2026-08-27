import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import {
  Alert,
  Avatar,
  Button,
  Card,
  CardHead,
  Field,
  Input,
  StatCard,
  useToast,
} from '../components/ui.jsx';
import { AuthAPI, ClaimsAPI, ItemsAPI } from '../lib/api.js';
import { formatDate } from '../lib/format.js';
import { useAuth } from '../lib/auth.jsx';

export default function Profile() {
  const { user, setUser, logout, meta } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    campus: user?.campus || '',
    avatar_hue: user?.avatar_hue || 265,
  });
  const [pw, setPw] = useState({ current_password: '', new_password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState({ reports: 0, returned: 0, claims: 0 });

  useEffect(() => {
    Promise.all([ItemsAPI.list({ mine: 1, limit: 200 }), ClaimsAPI.list()])
      .then(([i, c]) => {
        const items = i.items || [];
        setStats({
          reports: items.length,
          returned: items.filter((x) => ['returned', 'closed'].includes(x.status)).length,
          claims: (c.claims || []).length,
        });
      })
      .catch(() => {});
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { user: updated } = await AuthAPI.updateProfile(form);
      setUser(updated);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pw.new_password !== pw.confirm) return toast.error('New passwords do not match');
    setBusy(true);
    try {
      await AuthAPI.changePassword({
        current_password: pw.current_password,
        new_password: pw.new_password,
      });
      setPw({ current_password: '', new_password: '', confirm: '' });
      toast.success('Password changed');
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
          <div className="eyebrow mb-2">Profile</div>
          <h1>Your account</h1>
          <p>Update your details, tune your avatar and manage your password.</p>
        </div>
        <Button variant="subtle" icon="logout" onClick={logout}>
          Sign out
        </Button>
      </div>

      <div className="grid grid-3 mb-6">
        <StatCard icon="box" label="Total reports" value={stats.reports} />
        <StatCard icon="handshake" label="Items returned" value={stats.returned} />
        <StatCard icon="shield" label="Claims involved" value={stats.claims} />
      </div>

      <div className="detail-grid">
        <div className="col gap-6">
          <Card>
            <CardHead title="Personal details" icon="user" />
            <form className="card-body col gap-5" onSubmit={save}>
              <Field label="Full name" required>
                <Input icon="user" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field label="Email" hint="Email is your login and cannot be changed here.">
                <Input icon="mail" value={user?.email || ''} disabled />
              </Field>
              <div className="grid grid-2" style={{ gap: 'var(--s-4)' }}>
                <Field label="Phone" hint="Never shown publicly">
                  <Input
                    icon="phone"
                    placeholder="+91 …"
                    value={form.phone || ''}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </Field>
                <Field label="Campus / branch">
                  <Input
                    icon="building"
                    placeholder="Main Campus"
                    value={form.campus || ''}
                    onChange={(e) => setForm({ ...form, campus: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Avatar colour" hint="Drag to shift the hue of your glowing avatar.">
                <div className="row gap-4">
                  <Avatar name={form.name} hue={form.avatar_hue} size="lg" />
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={form.avatar_hue}
                    onChange={(e) => setForm({ ...form, avatar_hue: Number(e.target.value) })}
                    style={{ flex: 1, accentColor: 'var(--violet-400)' }}
                  />
                </div>
              </Field>
              <Button type="submit" loading={busy} iconRight="check">
                Save changes
              </Button>
            </form>
          </Card>

          <Card>
            <CardHead title="Password" icon="lock" />
            <form className="card-body col gap-5" onSubmit={changePassword}>
              <Field label="Current password" required>
                <Input
                  type="password"
                  icon="lock"
                  value={pw.current_password}
                  onChange={(e) => setPw({ ...pw, current_password: e.target.value })}
                  required
                />
              </Field>
              <div className="grid grid-2" style={{ gap: 'var(--s-4)' }}>
                <Field label="New password" required>
                  <Input
                    type="password"
                    icon="lock"
                    value={pw.new_password}
                    onChange={(e) => setPw({ ...pw, new_password: e.target.value })}
                    required
                  />
                </Field>
                <Field label="Confirm new password" required>
                  <Input
                    type="password"
                    icon="lock"
                    value={pw.confirm}
                    onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                    required
                  />
                </Field>
              </div>
              <Button type="submit" variant="ghost" loading={busy} icon="shield">
                Update password
              </Button>
            </form>
          </Card>
        </div>

        <div className="col gap-6 sticky-side">
          <Card className="card-pad col gap-4 center" style={{ textAlign: 'center' }}>
            <Avatar name={user?.name} hue={user?.avatar_hue} size="lg" />
            <div>
              <h3 style={{ fontSize: 'var(--fs-lg)' }}>{user?.name}</h3>
              <div className="small muted">{user?.email}</div>
            </div>
            <div className="row gap-2 center row-wrap">
              <span className="badge badge-violet">{user?.role === 'admin' ? 'Administrator' : 'Member'}</span>
              <span className="tag">
                <Icon name="calendar" size={12} /> Joined {formatDate(user?.created_at)}
              </span>
            </div>
          </Card>

          <Card>
            <CardHead title="Privacy" icon="shield" />
            <div className="card-body col gap-3 small soft">
              {[
                'Your name appears masked (e.g. Aa••• S.) on public listings.',
                'Your email is masked until a claim you are part of is approved.',
                'Phone numbers are never exposed through the API.',
                'Private verification answers you store are never returned to any client.',
              ].map((t) => (
                <div className="row gap-2" key={t}>
                  <Icon name="check" size={14} style={{ color: 'var(--violet-300)', flex: '0 0 auto', marginTop: 3 }} />
                  {t}
                </div>
              ))}
            </div>
          </Card>

          {meta?.matching && (
            <Card>
              <CardHead title="Matching engine" subtitle="Current tuning" icon="sliders" />
              <div className="card-body col gap-2 small">
                {Object.entries(meta.matching.weights).map(([k, v]) => (
                  <div className="row-between" key={k}>
                    <span className="soft" style={{ textTransform: 'capitalize' }}>{k}</span>
                    <span className="mono muted">{v}%</span>
                  </div>
                ))}
                <div className="divider" style={{ margin: 'var(--s-2) 0' }} />
                <div className="row-between">
                  <span className="soft">Match threshold</span>
                  <span className="mono muted">{meta.matching.threshold}%</span>
                </div>
                <div className="row-between">
                  <span className="soft">Image similarity</span>
                  <span className="mono muted">
                    {meta.matching.image_similarity_enabled ? 'enabled' : 'off'}
                  </span>
                </div>
              </div>
            </Card>
          )}

          {user?.role === 'admin' && (
            <Alert icon="shield">
              You have administrator access. Open the <a href="/admin">Admin Console</a> for moderation,
              disputes and analytics.
            </Alert>
          )}
        </div>
      </div>
    </>
  );
}
