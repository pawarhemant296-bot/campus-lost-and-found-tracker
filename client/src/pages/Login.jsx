import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Alert, Button, Card, Field, Input, useToast } from '../components/ui.jsx';
import { Logo } from '../components/PublicLayout.jsx';
import { useAuth } from '../lib/auth.jsx';

const DEMO = [
  { email: 'aarav@college.edu', password: 'demo1234', role: 'Owner — lost the wallet' },
  { email: 'priya@college.edu', password: 'demo1234', role: 'Finder — found the wallet' },
  { email: 'admin@traceback.io', password: 'admin1234', role: 'Administrator' },
];

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e, override) => {
    e?.preventDefault();
    const creds = override || form;
    setError('');
    setBusy(true);
    try {
      const user = await login(creds.email, creds.password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      const to = location.state?.from || (user.role === 'admin' ? '/admin' : '/app');
      navigate(to, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap shell">
      <Card glow className="auth-card">
        <div className="col gap-2 center" style={{ textAlign: 'center' }}>
          <Logo />
          <h2 className="mt-4">Welcome back</h2>
          <p className="small">Sign in to track your reports, matches and claims.</p>
        </div>

        <form className="col gap-5 mt-8" onSubmit={submit}>
          {error && <Alert tone="error">{error}</Alert>}

          <Field label="Email address" required htmlFor="email">
            <Input
              id="email"
              type="email"
              icon="mail"
              autoComplete="email"
              placeholder="you@college.edu"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </Field>

          <Field label="Password" required htmlFor="password">
            <Input
              id="password"
              type="password"
              icon="lock"
              autoComplete="current-password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </Field>

          <Button type="submit" block loading={busy} iconRight="arrowRight">
            Login
          </Button>
        </form>

        <div className="divider" />

        <div className="col gap-2">
          <div className="row-between">
            <span className="eyebrow">Demo accounts</span>
            <span className="tiny faint">one click</span>
          </div>
          {DEMO.map((d) => (
            <button
              key={d.email}
              type="button"
              className="demo-chip"
              onClick={(e) => submit(e, d)}
              disabled={busy}
            >
              <span>
                <span className="strong" style={{ color: 'var(--violet-200)' }}>
                  {d.email}
                </span>
                <span style={{ display: 'block' }}>{d.role}</span>
              </span>
              <Icon name="arrowRight" size={14} />
            </button>
          ))}
        </div>

        <p className="small center-text mt-6">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
        <p className="tiny center-text faint mt-2">
          <Link to="/" className="row gap-2 center" style={{ justifyContent: 'center' }}>
            <Icon name="arrowLeft" size={12} /> Back to home
          </Link>
        </p>
      </Card>
    </div>
  );
}
