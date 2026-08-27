import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { Alert, Button, Card, Field, Input, ToggleGroup, useToast } from '../components/ui.jsx';
import { Logo } from '../components/PublicLayout.jsx';
import { useAuth } from '../lib/auth.jsx';

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    campus: '',
    password: '',
    confirm: '',
    role: 'user',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('Passwords do not match');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');

    setBusy(true);
    try {
      const user = await register({
        name: form.name,
        email: form.email,
        password: form.password,
        campus: form.campus,
        role: form.role,
      });
      toast.success('Account created — welcome to TraceBack');
      navigate(user.role === 'admin' ? '/admin' : '/app', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap shell">
      <Card glow className="auth-card" style={{ width: 'min(500px, 100%)' }}>
        <div className="col gap-2 center" style={{ textAlign: 'center' }}>
          <Logo />
          <h2 className="mt-4">Create your account</h2>
          <p className="small">Report items, get match alerts and track every return.</p>
        </div>

        <form className="col gap-5 mt-8" onSubmit={submit}>
          {error && <Alert tone="error">{error}</Alert>}

          <Field label="Full name" required>
            <Input icon="user" placeholder="Aarav Sharma" value={form.name} onChange={set('name')} required />
          </Field>

          <Field label="Email address" required>
            <Input
              type="email"
              icon="mail"
              placeholder="you@college.edu"
              autoComplete="email"
              value={form.email}
              onChange={set('email')}
              required
            />
          </Field>

          <Field label="Campus / branch" hint="Optional — helps narrow location matching">
            <Input icon="building" placeholder="Main Campus" value={form.campus} onChange={set('campus')} />
          </Field>

          <div className="grid grid-2" style={{ gap: 'var(--s-4)' }}>
            <Field label="Password" required>
              <Input
                type="password"
                icon="lock"
                placeholder="min. 6 characters"
                autoComplete="new-password"
                value={form.password}
                onChange={set('password')}
                required
              />
            </Field>
            <Field label="Confirm password" required>
              <Input
                type="password"
                icon="lock"
                placeholder="repeat password"
                autoComplete="new-password"
                value={form.confirm}
                onChange={set('confirm')}
                required
              />
            </Field>
          </div>

          <Field label="Account role" hint="Admins get the moderation console, analytics and dispute tools.">
            <ToggleGroup
              value={form.role}
              onChange={(role) => setForm({ ...form, role })}
              options={[
                { value: 'user', label: 'User', icon: 'user' },
                { value: 'admin', label: 'Admin', icon: 'shield' },
              ]}
            />
          </Field>

          <Button type="submit" block loading={busy} iconRight="arrowRight">
            Create Account
          </Button>
        </form>

        <p className="small center-text mt-6">
          Already have an account? <Link to="/login">Login</Link>
        </p>
        <p className="tiny center-text faint mt-2">
          <Link to="/" className="row gap-2" style={{ justifyContent: 'center' }}>
            <Icon name="arrowLeft" size={12} /> Back to home
          </Link>
        </p>
      </Card>
    </div>
  );
}
