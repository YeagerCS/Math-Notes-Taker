import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { NotebookCover } from '../features/dashboard/NotebookCover';
import { useIsLoggedIn } from './RequireAuth';
import { session } from './session';
import './login.css';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const loggedIn = useIsLoggedIn();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/';
  if (loggedIn) return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      session.set(await api.login(password));
      navigate(from, { replace: true });
    } catch (err) {
      setPassword('');
      setError(describe(err));
      setLocked(err instanceof ApiError && err.status === 423);
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <form className="login__card" onSubmit={submit}>
        <div className="login__cover">
          <NotebookCover title="Math Notes" color="navy" size="sm" />
        </div>
        <h1 className="login__title">Welcome back</h1>
        <p className="login__subtitle">Enter your password to open your notebooks.</p>

        <input
          className="input login__input"
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          aria-label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
          autoFocus
        />
        {error && (
          <p className={`login__error ${locked ? 'is-locked' : ''}`} role="alert">
            {error}
          </p>
        )}
        <button className="btn btn--primary login__submit" disabled={busy || !password}>
          {busy ? 'Checking…' : 'Log in'}
        </button>
      </form>
    </main>
  );
}

function describe(err: unknown): string {
  if (!(err instanceof ApiError)) return "Couldn't reach the server.";
  if (err.status === 423) {
    const until = err.body?.lockedUntil as string | null | undefined;
    return until
      ? `Too many wrong attempts. Login is locked until ${new Date(until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`
      : 'Too many wrong attempts. Login is locked until it is unlocked on the server.';
  }
  if (err.status === 401) {
    const left = err.body?.attemptsLeft as number | undefined;
    return left !== undefined ? `Wrong password — ${left} ${left === 1 ? 'attempt' : 'attempts'} left.` : 'Wrong password.';
  }
  return err.message;
}
