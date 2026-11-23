import { useCallback, useEffect, useMemo, useState } from 'react';
import { stacksByCard, type CollectionCopy } from '@pixel-packs/shared';
import { binderApi } from './api.js';

export type CollectionState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; copies: CollectionCopy[] };

/** The player's live copies, grouped per card (best first), with a reload after dusting. */
export function useCollection(load: () => Promise<CollectionCopy[]> = binderApi.collection) {
  const [state, setState] = useState<CollectionState>({ status: 'loading' });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    load().then(
      (copies) => {
        if (live) setState({ status: 'ready', copies });
      },
      (err: unknown) => {
        if (live)
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'The binder would not open.',
          });
      },
    );
    return () => {
      live = false;
    };
  }, [load, tick]);
  const copies = state.status === 'ready' ? state.copies : null;
  const stacks = useMemo(() => stacksByCard(copies ?? []), [copies]);
  const reload = useCallback(() => {
    setTick((t) => t + 1);
  }, []);
  /** Drops copies locally right away (the server already removed them). */
  const remove = useCallback((ids: readonly string[]) => {
    const gone = new Set(ids);
    setState((s) =>
      s.status === 'ready' ? { ...s, copies: s.copies.filter((c) => !gone.has(c.userCardId)) } : s,
    );
  }, []);
  return { state, stacks, reload, remove };
}
