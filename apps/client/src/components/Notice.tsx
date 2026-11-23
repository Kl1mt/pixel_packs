import { useEffect, type ReactNode } from 'react';
import { audio } from '../audio/audio.js';

/** A stamped note on parchment: `error` is announced right away, `info` politely. */
export function Notice({ tone, children }: { tone: 'info' | 'error'; children: ReactNode }) {
  useEffect(() => {
    if (tone === 'error') audio.play('ui.error');
  }, [tone]);
  return (
    <p className={`notice notice--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}
