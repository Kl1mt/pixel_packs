import type { CSSProperties } from 'react';
import { CARD_CATALOG, UI_SCALE, type CollectionCopy } from '@pixel-packs/shared';
import { Button } from '../components/Button.js';
import { Card } from '../components/Card.js';
import { Panel } from '../components/Panel.js';

const BY_ID = new Map(CARD_CATALOG.map((c) => [c.id, c]));
const PLACE = ['Front', '2nd', '3rd', '4th', 'Back'];

export interface StarterCardsProps {
  copies: readonly CollectionCopy[];
  busy: boolean;
  onDone: () => void;
}

/** The five account-bound starter cards (GDD §17 step 4), laid out as a caravan. */
export function StarterCards({ copies, busy, onDone }: StarterCardsProps) {
  return (
    <Panel className="starter" aria-label="Starter cards">
      <h2>Five friends for the road</h2>
      <p>
        These five are yours for good. They&rsquo;re bound to your account, so they can&rsquo;t be
        traded or dusted. Together they make a caravan, front to back.
      </p>
      <ol className="starter__row">
        {copies.map((copy, i) => {
          const card = BY_ID.get(copy.cardId);
          if (!card) return null;
          return (
            <li
              key={copy.userCardId}
              className="starter__card"
              style={{ '--i': i } as CSSProperties}
            >
              <Card card={card} scale={UI_SCALE} />
              <span className="starter__place small">{PLACE[i]}</span>
            </li>
          );
        })}
      </ol>
      <div className="welcome__actions">
        <Button disabled={busy} onClick={onDone}>
          Take them home
        </Button>
      </div>
    </Panel>
  );
}
