import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    if (form.password !== form.confirm) {
      setError('The two passwords do not match');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user = await register({
        name: form.name,
        email: form.email,
        phone: form.phone,
        password: form.password,
      });
      toast.success(`Account created — welcome, ${user.name.split(' ')[0]}`);
      navigate('/dashboard', { replace: true });
    } catch (registerError) {
      setError(registerError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 520 }}>
      <div className="card">
        <h1>Create your account</h1>
        <p className="muted">You need an account to report items, claim them and chat securely.</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={submit}>
          <div className="field">
            <label className="label" htmlFor="name">
              Full name
            </label>
            <input id="name" required minLength={2} value={form.name} onChange={update('name')} />
          </div>
          <div className="field">
            <label className="label" htmlFor="email">
              Email
            </label>
            <input id="email" type="email" required value={form.email} onChange={update('email')} />
            <div className="hint">
              Set <code>ALLOWED_EMAIL_DOMAINS</code> on the server to restrict sign-ups to your college domain.
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="phone">
              Phone <span className="muted">(optional, shared only after a claim is approved)</span>
            </label>
            <input id="phone" value={form.phone} onChange={update('phone')} />
          </div>
          <div className="form-grid">
            <div className="field">
              <label className="label" htmlFor="password">
                Password
              </label>
              <input id="password" type="password" required minLength={6} value={form.password} onChange={update('password')} />
            </div>
            <div className="field">
              <label className="label" htmlFor="confirm">
                Confirm password
              </label>
              <input id="confirm" type="password" required minLength={6} value={form.confirm} onChange={update('confirm')} />
            </div>
          </div>
          <button type="submit" className="btn btn-block btn-lg" disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="small muted" style={{ marginTop: 14 }}>
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
