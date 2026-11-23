import { useState, type SyntheticEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Button } from '../components/Button.js';
import { Notice } from '../components/Notice.js';
import { TextField } from '../components/TextField.js';
import { ApiError } from '../http.js';
import { AuthPanel } from './AuthLayout.js';
import { DiscordButton } from './DiscordButton.js';
import { oauthMessage, safeNext } from './messages.js';
import { sessionStore } from './useSession.js';

export function LoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const oauth = oauthMessage(params.get('oauth'));
  const next = params.get('next');

  async function submit(e: SyntheticEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await sessionStore.login({ email, password });
      void navigate(safeNext(next), { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  }

  return (
    <AuthPanel title="Welcome back">
      <p>Your binder missed you. Log in to keep collecting.</p>
      {oauth && <Notice tone={oauth.outcome === 'linked' ? 'info' : 'error'}>{oauth.text}</Notice>}
      <form className="form" onSubmit={(e) => void submit(e)} noValidate>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
          }}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
          }}
        />
        {error && <Notice tone="error">{error}</Notice>}
        <div className="form__actions">
          <Button type="submit" disabled={busy}>
            {busy ? 'Opening…' : 'Log in'}
          </Button>
          <Link to="/forgot-password" className="small">
            Forgot your password?
          </Link>
        </div>
      </form>
      <DiscordButton label="Log in with Discord" />
      <p className="auth__switch">
        New here?{' '}
        <Link to={next ? `/register?next=${encodeURIComponent(next)}` : '/register'}>
          Make an account
        </Link>
      </p>
    </AuthPanel>
  );
}
