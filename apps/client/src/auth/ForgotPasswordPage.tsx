import { useState, type SyntheticEvent } from 'react';
import { Link } from 'react-router';
import { EmailSchema } from '@pixel-packs/shared';
import { Button } from '../components/Button.js';
import { Notice } from '../components/Notice.js';
import { TextField } from '../components/TextField.js';
import { ApiError } from '../http.js';
import { authApi } from './api.js';
import { AuthPanel } from './AuthLayout.js';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: SyntheticEvent) {
    e.preventDefault();
    if (!EmailSchema.safeParse(email).success) {
      setError('That doesn’t look like an email.');
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      await authApi.requestReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPanel title="Lost your key?">
      {sent ? (
        <>
          <Notice tone="info">
            If an account uses {email}, a letter with a reset link is on its way. It works for one
            hour.
          </Notice>
          <p className="auth__switch">
            <Link to="/login">Back to log in</Link>
          </p>
        </>
      ) : (
        <>
          <p>Tell us your email and we’ll send a link to choose a new password.</p>
          <form className="form" onSubmit={(e) => void submit(e)} noValidate>
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              error={error}
              onChange={(e) => {
                setEmail(e.target.value);
              }}
            />
            <div className="form__actions">
              <Button type="submit" disabled={busy}>
                Send the link
              </Button>
              <Link to="/login" className="small">
                Back to log in
              </Link>
            </div>
          </form>
        </>
      )}
    </AuthPanel>
  );
}
