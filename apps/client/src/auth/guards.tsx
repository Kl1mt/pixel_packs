import type { ReactNode } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router';
import { Button } from '../components/Button.js';
import { Panel } from '../components/Panel.js';
import { safeNext } from './messages.js';
import { sessionStore, useSession } from './useSession.js';

/** Waiting for `/api/auth/me`, or the server is down. */
function SessionPending({ offline }: { offline: boolean }) {
  if (!offline) {
    return (
      <p className="session-wait" role="status">
        Opening the door…
      </p>
    );
  }
  return (
    <Panel className="narrow session-wait">
      <h2>The post office is closed</h2>
      <p>We can’t reach the server right now. Check your connection and try again.</p>
      <Button onClick={() => void sessionStore.refresh()}>Try again</Button>
    </Panel>
  );
}

/** In-game routes: guests are sent to the login screen, then back here. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession();
  const location = useLocation();
  if (session.status === 'loading' || session.status === 'offline') {
    return <SessionPending offline={session.status === 'offline'} />;
  }
  if (session.status === 'guest') {
    const next = `${location.pathname}${location.search}`;
    const to = next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`;
    return <Navigate to={to} replace />;
  }
  return children;
}

/** Login / register / forgot: a logged-in player goes straight on. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const session = useSession();
  const [params] = useSearchParams();
  if (session.status === 'loading' || session.status === 'offline') {
    return <SessionPending offline={session.status === 'offline'} />;
  }
  if (session.status === 'user') return <Navigate to={safeNext(params.get('next'))} replace />;
  return children;
}
