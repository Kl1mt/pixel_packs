import type { ReactNode } from 'react';

/** A stamped note on parchment: `error` is announced right away, `info` politely. */
export function Notice({ tone, children }: { tone: 'info' | 'error'; children: ReactNode }) {
  return (
    <p className={`notice notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}
