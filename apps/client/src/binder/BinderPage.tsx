import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  CARD_CATALOG,
  DEFAULT_BINDER_FILTER,
  realmCompletion,
  type BinderFilter,
  type BinderSort,
} from '@pixel-packs/shared';
import { CardBack } from '../components/Card.js';
import { Notice } from '../components/Notice.js';
import { Panel } from '../components/Panel.js';
import { binderApi } from './api.js';
import { BinderTabs } from './BinderTabs.js';
import { Book } from './Book.js';
import { DustExtras } from './DustExtras.js';
import { Filters } from './Filters.js';
import { Inspect } from './Inspect.js';
import { BINDER_REALMS, bookLayout, bookSpreads, useWidth } from './layout.js';
import { realmName } from './realms.js';
import './binder.css';
import { useCollection } from './useCollection.js';

const BY_ID = new Map(CARD_CATALOG.map((c) => [c.id, c]));

/** Binder book (GDD §12): realm tabs, filters and sorting, page turns, and card inspect. */
export function BinderPage({ api = binderApi }: { api?: typeof binderApi }) {
  const { state, stacks, remove, reload } = useCollection(api.collection);
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState<BinderFilter>(DEFAULT_BINDER_FILTER);
  const [sort, setSort] = useState<BinderSort>('number');
  const [note, setNote] = useState<string | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const { pagesPerSpread, cardScale } = bookLayout(useWidth(host));
  const spreads = useMemo(
    () => bookSpreads(stacks, filter, sort, pagesPerSpread),
    [stacks, filter, sort, pagesPerSpread],
  );
  const freeze = params.get('freeze');
  const frozenAt = freeze === null ? undefined : Number(freeze);

  // Where the book is open: a realm and a spread within it (survives filters and resizes).
  const [pos, setPos] = useState(() => ({
    realm: BINDER_REALMS.find((r) => r === params.get('realm')) ?? BINDER_REALMS[0],
    offset: 0,
  }));
  const firstOf = (realm: string | undefined) =>
    Math.max(
      0,
      spreads.findIndex((s) => s.realm === realm),
    );
  const realmEnd = spreads.findLastIndex((s) => s.realm === pos.realm);
  const index = Math.min(firstOf(pos.realm) + pos.offset, Math.max(realmEnd, 0));
  const spread = spreads[index];
  const turnTo = (i: number) => {
    const realm = spreads[i]?.realm;
    if (realm) setPos({ realm, offset: i - firstOf(realm) });
  };
  const changeFilter = (f: BinderFilter) => {
    setFilter(f);
    setPos((p) => ({ ...p, offset: 0 }));
  };

  const cardId = params.get('card');
  const inspected = cardId ? BY_ID.get(cardId) : undefined;
  const inspectedCopies = inspected ? (stacks.get(inspected.id) ?? []) : [];
  const setCard = (id: string | null) => {
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (id) next.set('card', id);
        else next.delete('card');
        return next;
      },
      { replace: id === null },
    );
  };

  const copies = state.status === 'ready' ? state.copies : [];
  return (
    <>
      <h1 className="page-title">Binder</h1>
      <BinderTabs />
      {state.status === 'error' && <Notice tone="error">{state.message}</Notice>}
      {state.status === 'ready' && copies.length === 0 && (
        <Panel className="empty">
          <CardBack className="empty__art" />
          <div>
            <h2>Nothing tucked in yet</h2>
            <p>Your binder is waiting for its first card. Open a pack and it will find its page.</p>
            <Link className="btn" to="/packs">
              Find a pack
            </Link>
          </div>
        </Panel>
      )}
      <div
        ref={host}
        className="binder"
        data-ready={state.status === 'ready' ? 'true' : undefined}
        hidden={state.status === 'ready' && copies.length === 0}
      >
        <div className="binder__realms" role="tablist" aria-label="Realms">
          {BINDER_REALMS.map((realm) => {
            const done = realmCompletion(CARD_CATALOG, realm, stacks);
            const active = spread?.realm === realm;
            return (
              <button
                key={realm}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="binder-book"
                className={`binder__realm binder__realm--${realm}`}
                onClick={() => {
                  setPos({ realm, offset: 0 });
                }}
              >
                {realmName(realm)}{' '}
                <span className="binder__done">
                  {done.owned}/{done.total}
                </span>
              </button>
            );
          })}
        </div>
        <Panel material="wood" className="binder__tools">
          <Filters filter={filter} sort={sort} onFilter={changeFilter} onSort={setSort}>
            <DustExtras
              api={api}
              onDusted={(count, dust) => {
                setNote(
                  count === 0
                    ? 'Nothing to dust.'
                    : `Dusted ${String(count)} extras for ${String(dust)} Stardust.`,
                );
                reload();
              }}
            />
          </Filters>
        </Panel>
        {note && <Notice tone="info">{note}</Notice>}
        {state.status === 'loading' && <p className="on-ground">Opening the binder…</p>}
        {state.status === 'ready' && (
          <Book
            spreads={spreads}
            index={index}
            onIndex={turnTo}
            scale={cardScale}
            pagesPerSpread={pagesPerSpread}
            onOpen={setCard}
          />
        )}
      </div>
      {inspected && inspectedCopies.length > 0 && (
        <Inspect
          key={inspected.id}
          card={inspected}
          copies={inspectedCopies}
          api={api}
          frozenAt={frozenAt}
          onClose={() => {
            setCard(null);
          }}
          onDusted={(ids, dust) => {
            remove(ids);
            setNote(
              `Dusted ${String(ids.length)} ${ids.length === 1 ? 'copy' : 'copies'} of ${inspected.name} for ${String(dust)} Stardust.`,
            );
            if (ids.length >= inspectedCopies.length) setCard(null);
          }}
        />
      )}
    </>
  );
}
