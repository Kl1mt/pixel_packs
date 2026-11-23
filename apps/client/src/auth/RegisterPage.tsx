import { useState, type SyntheticEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import {
  EmailSchema,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  UsernameSchema,
} from '@pixel-packs/shared';
import { Button } from '../components/Button.js';
import { Notice } from '../components/Notice.js';
import { TextField } from '../components/TextField.js';
import { ApiError } from '../http.js';
import { AuthPanel } from './AuthLayout.js';
import { DiscordButton } from './DiscordButton.js';
import { FIELD_FOR_CODE, safeNext } from './messages.js';
import { sessionStore } from './useSession.js';

type Field = 'email' | 'username' | 'password';
type Errors = Partial<Record<Field, string>>;

/** Client-side checks with the same shared rules the server uses. */
export function validateRegister(v: Record<Field, string>): Errors {
  const errors: Errors = {};
  if (!EmailSchema.safeParse(v.email).success) errors.email = 'That doesn’t look like an email.';
  const name = UsernameSchema.safeParse(v.username);
  if (!name.success) errors.username = name.error.issues[0]?.message ?? 'Pick another name.';
  if (v.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Use at least ${String(PASSWORD_MIN_LENGTH)} characters.`;
  } else if (v.password.length > PASSWORD_MAX_LENGTH) {
    errors.password = `Use at most ${String(PASSWORD_MAX_LENGTH)} characters.`;
  }
  return errors;
}

export function RegisterPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [values, setValues] = useState<Record<Field, string>>({
    email: '',
    username: '',
    password: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const bind = (field: Field) => ({
    value: values[field],
    error: errors[field],
    onChange: (e: { target: { value: string } }) => {
      setValues((v) => ({ ...v, [field]: e.target.value }));
    },
  });

  async function submit(e: SyntheticEvent) {
    e.preventDefault();
    setFormError(null);
    const found = validateRegister(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      await sessionStore.register(values);
      void navigate(safeNext(params.get('next')), { replace: true });
    } catch (err) {
      setBusy(false);
      const field = err instanceof ApiError ? FIELD_FOR_CODE[err.code] : undefined;
      const message = err instanceof ApiError ? err.message : 'Something went wrong.';
      if (field) setErrors({ [field]: message });
      else setFormError(message);
    }
  }

  return (
    <AuthPanel title="Make an account">
      <p>Pick a name for your binder. Your first satchel of packs is waiting.</p>
      <form className="form" onSubmit={(e) => void submit(e)} noValidate>
        <TextField label="Email" type="email" autoComplete="email" required {...bind('email')} />
        <TextField
          label="Username"
          autoComplete="username"
          hint="3–20 letters, digits or _. Other players will see it."
          required
          {...bind('username')}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint={`At least ${String(PASSWORD_MIN_LENGTH)} characters.`}
          required
          {...bind('password')}
        />
        {formError && <Notice tone="error">{formError}</Notice>}
        <div className="form__actions">
          <Button type="submit" disabled={busy}>
            {busy ? 'Signing…' : 'Sign up'}
          </Button>
        </div>
      </form>
      <DiscordButton label="Sign up with Discord" />
      <p className="auth__switch">
        Already collecting? <Link to="/login">Log in</Link>
      </p>
    </AuthPanel>
  );
}
