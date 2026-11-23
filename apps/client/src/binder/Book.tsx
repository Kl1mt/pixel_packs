import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { BINDER_PAGE_SIZE, type BinderSlot } from '@pixel-packs/shared';
import { Button } from '../components/Button.js';
import { Panel } from '../components/Panel.js';
import type { Spread } from './layout.js';
import { Pocket } from './Pocket.js';
import { realmName } from './realms.js';

/** How long the turning leaf takes (MOTION.slow). */
const TURN_MS = 250;

function Page({
  slots,
  number,
  of,
  scale,
  onOpen,
}: {
  slots: readonly BinderSlot[];
  number: number;
  of: number;
  scale: number;
  onOpen: (cardId: string) => void;
}) {
  const empty = BINDER_PAGE_SIZE - slots.length;
  return (
    <section className="binder__page" aria-label={`Page ${String(number)} of ${String(of)}`}>
      <div className="binder__pockets">
        {slots.map((s) => (
          <Pocket key={s.card.id} slot={s} scale={scale} onOpen={onOpen} />
        ))}
        {Array.from({ length: empty }, (_, i) => (
          <div key={`e${String(i)}`} className="pocket pocket--empty" aria-hidden="true" />
        ))}
      </div>
      <p className="binder__folio small">{number}</p>
    </section>
  );
}

export interface BookProps {
  spreads: readonly Spread[];
  index: number;
  onIndex: (i: number) => void;
  scale: number;
  pagesPerSpread: number;
  onOpen: (cardId: string) => void;
}

/**
 * The binder book: a wood cover holding one spread of parchment pages. Only the open
 * spread is in the DOM; turning plays a leaf across the spine (still under reduced motion).
 */
export function Book({ spreads, index, onIndex, scale, pagesPerSpread, onOpen }: BookProps) {
  const spread = spreads[index];
  const [turn, setTurn] = useState<{ dir: 'next' | 'prev'; n: number } | null>(null);
  const counter = useRef(0);
  useEffect(() => {
    if (!turn) return;
    const t = window.setTimeout(() => {
      setTurn(null);
    }, TURN_MS);
    return () => {
      window.clearTimeout(t);
    };
  }, [turn]);

  if (!spread) return null;
  const go = (to: number) => {
    if (to < 0 || to >= spreads.length || to === index) return;
    counter.current += 1;
    setTurn({ dir: to > index ? 'next' : 'prev', n: counter.current });
    onIndex(to);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') go(index + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(index - 1);
    else return;
    e.preventDefault();
  };
  const last = spread.first + spread.pages.length - 1;
  const where =
    spread.first === last
      ? `page ${String(spread.first)}`
      : `pages ${String(spread.first)}–${String(last)}`;

  return (
    <div className="binder__book-wrap" id="binder-book" role="tabpanel">
      <Panel
        as="div"
        material="wood"
        className="binder__book"
        data-spread={pagesPerSpread}
        style={{ '--pocket-scale': scale } as CSSProperties}
        onKeyDown={onKey}
      >
        <div className="binder__spread" key={index}>
          {spread.pages.map((slots, i) => (
            <Page
              key={spread.first + i}
              slots={slots}
              number={spread.first + i}
              of={spread.realmPages}
              scale={scale}
              onOpen={onOpen}
            />
          ))}
          {turn && (
            <span
              key={turn.n}
              className={`binder__leaf binder__leaf--${turn.dir}`}
              data-pages={pagesPerSpread}
              aria-hidden="true"
            />
          )}
        </div>
      </Panel>
      <div className="binder__turns">
        <Button
          onClick={() => {
            go(index - 1);
          }}
          disabled={index === 0}
          aria-label="Previous page"
        >
          ‹ Back
        </Button>
        <p className="binder__where on-ground small" aria-live="polite">
          {realmName(spread.realm)}, {where} of {spread.realmPages}
        </p>
        <Button
          onClick={() => {
            go(index + 1);
          }}
          disabled={index === spreads.length - 1}
          aria-label="Next page"
        >
          Next ›
        </Button>
      </div>
    </div>
  );
}
