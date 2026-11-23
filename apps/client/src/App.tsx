import { useEffect, useState } from 'react';
import { fetchHealth } from './api.js';

type Status = { kind: 'loading' } | { kind: 'ok'; db: string } | { kind: 'error'; message: string };

export function App() {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetchHealth()
      .then((h) => {
        if (!cancelled) setStatus({ kind: 'ok', db: h.db });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main>
      <h1>Pixel Packs</h1>
      <p data-testid="health">
        {status.kind === 'loading' && 'Checking server…'}
        {status.kind === 'ok' && `Server ok (${status.db})`}
        {status.kind === 'error' && `Server unreachable: ${status.message}`}
      </p>
    </main>
  );
}
