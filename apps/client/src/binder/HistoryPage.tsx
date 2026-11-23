import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import {
  CARD_CATALOG,
  RARITIES,
  VARIANTS,
  type PackOpening,
  type PackTypeId,
  type PullHistoryFilter,
  type Rarity,
  type Variant,
} from '@pixel-packs/shared';
import { Button } from '../components/Button.js';
import { Card, CardBack } from '../components/Card.js';
import { Notice } from '../components/Notice.js';
import { Panel } from '../components/Panel.js';
import { ApiError } from '../http.js';
import { binderApi } from './api.js';
import { BinderTabs } from './BinderTabs.js';
import { dateText, variantName } from './copyText.js';
import { BINDER_REALMS, useWidth } from './layout.js';
import { realmName } from './realms.js';
import './binder.css';

const BY_ID = new Map(CARD_CATALOG.map((c) => [c.id, c]));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

export const packName = (id: PackTypeId) =>
  id === 'mythic'
    ? 'Mythic pack'
    : `${realmName(id.slice(6) as Parameters<typeof realmName>[0])} pack`;

const PACKS: readonly PackTypeId[] = [...BINDER_REALMS.map((r) => `realm:${r}` as const), 'mythic'];

function Opening({ opening, scale }: { opening: PackOpening; scale: number }) {
  const cards = opening.revealOrder
    .map((slot) => opening.cards.find((c) => c.slot === slot))
    .filter((c) => c !== undefined);
  return (
    <Panel
      as="li"
      className="pull"
      aria-label={`${packName(opening.packTypeId)}, ${dateText(opening.createdAt)}`}
    >
      <p className="pull__head">
        <strong>{packName(opening.packTypeId)}</strong>{' '}
        <span className="muted small">
          {dateText(opening.createdAt)}, {TIME.format(new Date(opening.createdAt))}
        </span>
        {opening.scripted && <span className="pull__tag small">Welcome pack</span>}
        {opening.pityTrigger && <span className="pull__tag small">Pity</span>}
      </p>
      <ol className="pull__cards">
        {cards.map((c) => {
          const card = BY_ID.get(c.cardId);
          return (
            <li
              key={c.slot}
              className="pull__card"
              style={{ '--pocket-scale': scale } as CSSProperties}
            >
              <Link to={`/binder?card=${c.cardId}`} className="pull__link">
                {card ? (
                  <Card
                    card={card}
                    scale={scale}
                    variant={c.variant}
                    edition={c.edition}
                    mintNumber={c.mintNumber}
                  />
                ) : (
                  <CardBack />
                )}
                {c.variant !== 'normal' && (
                  <span
                    className={`pocket__sheen pocket__sheen--${c.variant}`}
                    aria-hidden="true"
                  />
                )}
              </Link>
              {c.isNew && <span className="pull__new small">New</span>}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

/** Every revealed opening, newest first, filterable by pack, rarity and variant (GDD §12). */
export function HistoryPage({ api = binderApi }: { api?: typeof binderApi }) {
  const [filter, setFilter] = useState<PullHistoryFilter>({});
  const [openings, setOpenings] = useState<PackOpening[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const host = useRef<HTMLDivElement>(null);
  const scale = useWidth(host) >= 1100 ? 2 : 1;

  const load = useCallback(
    (f: PullHistoryFilter, after: string | null) =>
      api.history(f, after).then(
        (page) => {
          setOpenings((o) => (after ? [...o, ...page.openings] : page.openings));
          setCursor(page.nextCursor);
          setStatus('ready');
        },
        (err: unknown) => {
          setError(err instanceof ApiError ? err.message : 'The history book would not open.');
          setStatus('error');
        },
      ),
    [api],
  );
  useEffect(() => {
    void load(filter, null);
  }, [load, filter]);

  const pick = (k: keyof PullHistoryFilter, v: string) => {
    setStatus('loading');
    setFilter((f) => ({ ...f, [k]: v === '' ? undefined : v }));
  };

  return (
    <>
      <h1 className="page-title">Binder</h1>
      <BinderTabs />
      <div ref={host} className="history">
        <Panel material="wood" className="binder__tools">
          <div className="binder__filters" role="group" aria-label="Filter pulls">
            <label className="binder__field">
              <span className="small">Pack</span>
              <select
                className="binder__select"
                value={filter.packTypeId ?? ''}
                onChange={(e) => {
                  pick('packTypeId', e.target.value);
                }}
              >
                <option value="">All packs</option>
                {PACKS.map((p) => (
                  <option key={p} value={p}>
                    {packName(p)}
                  </option>
                ))}
              </select>
            </label>
            <label className="binder__field">
              <span className="small">Best card</span>
              <select
                className="binder__select"
                value={filter.minRarity ?? ''}
                onChange={(e) => {
                  pick('minRarity', e.target.value);
                }}
              >
                <option value="">Any</option>
                {RARITIES.slice(1).map((r: Rarity) => (
                  <option key={r} value={r}>
                    {cap(r)} or better
                  </option>
                ))}
              </select>
            </label>
            <label className="binder__field">
              <span className="small">Variant</span>
              <select
                className="binder__select"
                value={filter.variant ?? ''}
                onChange={(e) => {
                  pick('variant', e.target.value);
                }}
              >
                <option value="">Any</option>
                {VARIANTS.slice(1).map((v: Variant) => (
                  <option key={v} value={v}>
                    {variantName(v)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Panel>
        {status === 'error' && <Notice tone="error">{error}</Notice>}
        {status !== 'loading' && openings.length === 0 && status === 'ready' && (
          <Panel className="empty">
            <CardBack className="empty__art" />
            <div>
              <h2>No pulls here yet</h2>
              <p>Every pack you open is written down here, card by card.</p>
              <Link className="btn" to="/packs">
                Find a pack
              </Link>
            </div>
          </Panel>
        )}
        <ol className="history__list" data-ready={status === 'ready' ? 'true' : undefined}>
          {openings.map((o) => (
            <Opening key={o.id} opening={o} scale={scale} />
          ))}
        </ol>
        {cursor && (
          <Button
            disabled={status === 'loading'}
            onClick={() => {
              setStatus('loading');
              void load(filter, cursor);
            }}
          >
            {status === 'loading' ? 'Turning pages…' : 'Show older pulls'}
          </Button>
        )}
      </div>
    </>
  );
}
