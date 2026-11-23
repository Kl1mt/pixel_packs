import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { LinkedAccountsResponse, PublicUser } from '@pixel-packs/shared';
import { Button } from '../components/Button.js';
import { Notice } from '../components/Notice.js';
import { Panel } from '../components/Panel.js';
import { ApiError } from '../http.js';
import { authApi, discordStartUrl } from './api.js';
import { oauthMessage } from './messages.js';
import { useProviders } from './useProviders.js';
import { sessionStore } from './useSession.js';

const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';

/** Settings → Account: email status, the Discord link, and logging out. */
export function AccountPanel({ user }: { user: PublicUser }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { discord: discordEnabled } = useProviders();
  const [linked, setLinked] = useState<LinkedAccountsResponse | null>(null);
  const [note, setNote] = useState<{ tone: 'info' | 'error'; text: string } | null>(() => {
    const m = oauthMessage(params.get('discord'));
    return m ? { tone: m.outcome === 'linked' ? 'info' : 'error', text: m.text } : null;
  });

  useEffect(() => {
    let live = true;
    authApi.linked().then(
      (l) => {
        if (live) setLinked(l);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      setNote({ tone: 'info', text: success });
    } catch (err) {
      setNote({ tone: 'error', text: errorText(err) });
    }
  }

  return (
    <Panel className="narrow settings account">
      <h2>Account</h2>
      <p>
        Logged in as <strong>{user.username}</strong> ({user.email}).
      </p>
      {user.emailVerified ? (
        <p className="muted small">Your email is verified.</p>
      ) : (
        <div className="row account__row">
          <p className="small">Your email isn’t verified yet. Check your inbox for our letter.</p>
          <Button
            onClick={() => void run(authApi.resendVerification, 'A fresh letter is on its way.')}
          >
            Send again
          </Button>
        </div>
      )}
      {discordEnabled && linked && (
        <div className="row account__row">
          {linked.discord ? (
            <>
              <p className="small">
                Discord: linked as <strong>{linked.discord.username}</strong>.
              </p>
              <Button
                onClick={() =>
                  void run(async () => {
                    await authApi.unlinkDiscord();
                    setLinked({ ...linked, discord: null });
                  }, 'Discord is unlinked.')
                }
              >
                Unlink
              </Button>
            </>
          ) : (
            <>
              <p className="small">Link Discord to log in with one click.</p>
              <a className="btn" href={discordStartUrl('link')}>
                Link Discord
              </a>
            </>
          )}
        </div>
      )}
      {note && <Notice tone={note.tone}>{note.text}</Notice>}
      <Button
        onClick={() =>
          void sessionStore.logout().then(
            () => navigate('/login', { replace: true }),
            (err: unknown) => {
              setNote({ tone: 'error', text: errorText(err) });
            },
          )
        }
      >
        Log out
      </Button>
    </Panel>
  );
}
