import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Eye, EyeOff, LoaderCircle, LockKeyhole, LogIn, Mail, ShieldCheck, WalletCards } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { CashAppRole } from '../types';

export const LoginPage = () => {
  const { authError, login } = useAuth();
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittingRole, setSubmittingRole] = useState<CashAppRole>('Staff');
  const [formError, setFormError] = useState('');

  const authenticate = async (role: CashAppRole) => {
    if (submitting) return;
    if (!email.trim() || !password) {
      setFormError('Enter your email and password.');
      return;
    }

    setSubmittingRole(role);
    setSubmitting(true);
    setFormError('');
    try {
      await login(email, password, role);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Login could not be completed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void authenticate('Staff');
  };

  const handleEmailKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    passwordInputRef.current?.focus();
  };

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-brand">
          <div className="brand-mark large"><WalletCards size={34} /></div>
          <div>
            <span>COMPANY ACCESS</span>
            <h1 id="login-title">Cash App</h1>
          </div>
        </div>
        {(formError || authError) ? <div className="notice error" role="alert">{formError || authError}</div> : null}

        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            Email
            <span className="input-with-icon">
              <Mail size={19} />
              <input
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={handleEmailKeyDown}
                autoComplete="email"
                autoCapitalize="none"
                enterKeyHint="next"
                inputMode="email"
                placeholder="staff@company.com"
                spellCheck={false}
                disabled={submitting}
              />
            </span>
          </label>
          <label>
            Password
            <span className="input-with-icon">
              <LockKeyhole size={19} />
              <input
                ref={passwordInputRef}
                name="password"
                type={passwordVisible ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                enterKeyHint="go"
                placeholder="Password"
                disabled={submitting}
              />
              <button
                className="password-toggle"
                type="button"
                onClick={() => setPasswordVisible((visible) => !visible)}
                disabled={submitting}
                title={passwordVisible ? 'Hide password' : 'Show password'}
                aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                aria-pressed={passwordVisible}
              >
                {passwordVisible ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </span>
          </label>
          <div className="login-actions">
            <button className="primary-button" type="submit" disabled={submitting} aria-busy={submitting && submittingRole === 'Staff'}>
              <LogIn size={20} /> {submitting && submittingRole === 'Staff' ? 'Signing in...' : 'Staff login'}
            </button>
            <button
              className="admin-login-button"
              type="button"
              disabled={submitting}
              aria-busy={submitting && submittingRole === 'Admin'}
              aria-label="Admin login"
              title="Admin login"
              onClick={() => void authenticate('Admin')}
            >
              {submitting && submittingRole === 'Admin'
                ? <LoaderCircle className="spin" size={20} />
                : <ShieldCheck size={20} />}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
};
