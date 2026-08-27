import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Field } from '../components/ui/Field.jsx';
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
            <Field id="name" label="Full name" required inputProps={{ minLength: 2 }} value={form.name} onChange={update('name')} />
          </div>
          <div className="field">
            <Field
              id="email"
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={update('email')}
              hint="Set ALLOWED_EMAIL_DOMAINS on the server to restrict sign-ups to your college domain."
            />
          </div>
          <div className="field">
            <Field
              id="phone"
              label="Phone (optional)"
              value={form.phone}
              onChange={update('phone')}
              hint="Shared only after a claim is approved."
            />
          </div>
          <div className="form-grid">
            <div className="field">
              <Field
                id="password"
                label="Password"
                type="password"
                required
                inputProps={{ minLength: 6 }}
                value={form.password}
                onChange={update('password')}
              />
            </div>
            <div className="field">
              <Field
                id="confirm"
                label="Confirm password"
                type="password"
                required
                inputProps={{ minLength: 6 }}
                value={form.confirm}
                onChange={update('confirm')}
              />
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
