import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Field } from '../components/ui/Field.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const DEMO_ACCOUNTS = [
  { label: 'Ananya (lost the wallet)', email: 'ananya@campus.edu', password: 'demo1234' },
  { label: 'Rahul (found the wallet)', email: 'rahul@campus.edu', password: 'demo1234' },
  { label: 'Campus admin', email: 'admin@campus.edu', password: 'admin123' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login(form);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      navigate(location.state?.from ?? '/dashboard', { replace: true });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 460 }}>
      <div className="card">
        <h1>Sign in</h1>
        <p className="muted">Track your reports, matches and claims.</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={submit}>
          <div className="field">
            <Field
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
          </div>
          <div className="field">
            <Field
              id="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </div>
          <button type="submit" className="btn btn-block btn-lg" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="small muted" style={{ marginTop: 14 }}>
          New here? <Link to="/register">Create an account</Link>
        </p>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h3>Demo accounts</h3>
        <p className="muted small">Seeded by <code>npm run db:seed</code>. One click fills the form.</p>
        <div className="stack" style={{ gap: 8 }}>
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setForm({ email: account.email, password: account.password })}
            >
              {account.label} — {account.email}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
