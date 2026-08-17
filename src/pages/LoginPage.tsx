import { useState, type FormEvent } from 'react';
import { LockKeyhole, LogIn, Mail, WalletCards } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginPage = () => {
  const { authError, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (!email.trim() || !password) {
      setFormError('Enter your email and password.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      await login(email, password);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Login could not be completed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-brand">
          <div className="brand-mark large"><WalletCards size={34} /></div>
          <div>
            <span>STAFF ACCESS</span>
            <h1 id="login-title">Cash App</h1>
          </div>
        </div>
        <p className="login-subtitle">Sign in with your company account.</p>

        {(formError || authError) ? <div className="notice error" role="alert">{formError || authError}</div> : null}

        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            Email
            <span className="input-with-icon">
              <Mail size={19} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                inputMode="email"
                placeholder="staff@company.com"
                disabled={submitting}
              />
            </span>
          </label>
          <label>
            Password
            <span className="input-with-icon">
              <LockKeyhole size={19} />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Password"
                disabled={submitting}
              />
            </span>
          </label>
          <button className="primary-button" type="submit" disabled={submitting}>
            <LogIn size={20} /> {submitting ? 'Signing in...' : 'Login'}
          </button>
        </form>
      </section>
    </main>
  );
};
