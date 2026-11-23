import { useState, type SyntheticEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { EmailTokenSchema, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@pixel-packs/shared';
import { Button } from '../components/Button.js';
import { Notice } from '../components/Notice.js';
import { TextField } from '../components/TextField.js';
import { ApiError } from '../http.js';
import { authApi } from './api.js';
import { AuthPanel } from './AuthLayout.js';
import { sessionStore } from './useSession.js';

/** `/reset-password?token=` from the reset email (T08). */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [errors, setErrors] = useState<{ password?: string; repeat?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!EmailTokenSchema.safeParse(token).success) {
    return (
      <AuthPanel title="This link is worn out">
        <p>The reset link is incomplete or has expired. Ask for a fresh one.</p>
        <Link className="btn" to="/forgot-password">
          New link
        </Link>
      </AuthPanel>
    );
  }

  async function submit(e: SyntheticEvent) {
    e.preventDefault();
    const found: typeof errors = {};
    if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
      found.password = `Use ${String(PASSWORD_MIN_LENGTH)}–${String(PASSWORD_MAX_LENGTH)} characters.`;
    } else if (password !== repeat) {
      found.repeat = 'The two passwords don’t match.';
    }
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      await authApi.confirmReset(token, password);
      sessionStore.loggedOut();
      setDone(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <AuthPanel title="New key cut">
        <Notice tone="info">Your password is changed and other devices are logged out.</Notice>
        <Link className="btn" to="/login">
          Log in
        </Link>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel title="Choose a new password">
      <form className="form" onSubmit={(e) => void submit(e)} noValidate>
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          hint={`At least ${String(PASSWORD_MIN_LENGTH)} characters.`}
          value={password}
          error={errors.password}
          onChange={(e) => {
            setPassword(e.target.value);
          }}
        />
        <TextField
          label="Repeat it"
          type="password"
          autoComplete="new-password"
          value={repeat}
          error={errors.repeat}
          onChange={(e) => {
            setRepeat(e.target.value);
          }}
        />
        {formError && <Notice tone="error">{formError}</Notice>}
        <div className="form__actions">
          <Button type="submit" disabled={busy}>
            Save password
          </Button>
        </div>
      </form>
    </AuthPanel>
  );
}
