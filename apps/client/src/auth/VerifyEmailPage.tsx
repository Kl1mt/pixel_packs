import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { EmailTokenSchema } from '@pixel-packs/shared';
import { Notice } from '../components/Notice.js';
import { authApi } from './api.js';
import { AuthPanel } from './AuthLayout.js';
import { sessionStore, useSession } from './useSession.js';

/** One request per token, even when StrictMode runs the effect twice. */
const attempts = new Map<string, Promise<boolean>>();
function verifyOnce(token: string): Promise<boolean> {
  let p = attempts.get(token);
  if (!p) {
    p = authApi.verifyEmail(token).then(
      () => true,
      () => false,
    );
    attempts.set(token, p);
  }
  return p;
}

/** `/verify-email?token=` from the verification email (T08). */
export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const valid = EmailTokenSchema.safeParse(token).success;
  const [result, setResult] = useState<'pending' | 'ok' | 'bad'>(valid ? 'pending' : 'bad');
  const session = useSession();

  useEffect(() => {
    if (!valid) return;
    let live = true;
    void verifyOnce(token).then(async (ok) => {
      if (ok) await sessionStore.refresh();
      if (live) setResult(ok ? 'ok' : 'bad');
    });
    return () => {
      live = false;
    };
  }, [token, valid]);

  const onward =
    session.status === 'user' ? (
      <Link className="btn" to="/">
        Go home
      </Link>
    ) : (
      <Link className="btn" to="/login">
        Log in
      </Link>
    );

  return (
    <AuthPanel title="Checking your letter">
      {result === 'pending' && <p role="status">Reading the stamp…</p>}
      {result === 'ok' && <Notice tone="info">Your email is verified. Thank you!</Notice>}
      {result === 'bad' && (
        <Notice tone="error">
          This link is invalid or has expired. You can ask for a new one in Settings.
        </Notice>
      )}
      {result !== 'pending' && onward}
    </AuthPanel>
  );
}
