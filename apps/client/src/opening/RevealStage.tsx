import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { OpenedCard } from '@pixel-packs/shared';
import { Button } from '../components/Button.js';
import { Card, CardBack } from '../components/Card.js';
import { cardFaceModel } from '../components/cardFace.js';
import { CardStage } from '../render/CardStage.js';
import { cardShown, momentPlan, type BeatAt } from './moment.js';
import { RevealMoment } from './RevealMoment.js';
import { backGlow, openedSpec } from './reveal.js';

export interface RevealStageProps {
  sequence: readonly OpenedCard[];
  flipped: number;
  auto: boolean;
  onFlip: () => void;
  onRevealAll: () => void;
  onSkip: () => void;
  onResults: () => void;
  /** Reduced effects: moments become short still frames. */
  reduced: boolean;
  /** A Legendary / Mythic moment or a variant stinger is playing (hold "Reveal all"). */
  onBusy?: (busy: boolean) => void;
  /** Hold moments at this many ms (screenshots). */
  momentFrozenAt?: number | undefined;
}

const RARITY_NAME: Record<OpenedCard['rarity'], string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic',
};

/** A pulled card's face: the live Pixi shader for special variants, the DOM card otherwise. */
export function OpenedFace({
  card,
  frozenAt,
}: {
  card: OpenedCard;
  frozenAt?: number | undefined;
}) {
  const spec = openedSpec(card);
  return card.variant === 'normal' ? (
    <Card {...spec} />
  ) : (
    <CardStage specs={[spec]} frozenAt={frozenAt} />
  );
}

/** A "NEW" stamp or an "extra" tag on a pulled card. */
export function NewTag({ card }: { card: OpenedCard }) {
  return card.isNew ? (
    <span className="stamp stamp--new">New</span>
  ) : (
    <span className="stamp stamp--extra">Extra</span>
  );
}

/**
 * Step 2: the card stack. Backs glow by rarity (Rare blue edge, Epic purple and
 * shaking; GDD §5); each flip shows the next card in reveal order in the spotlight,
 * the featured slot last. Earlier cards move to the tray.
 */
export function RevealStage(p: RevealStageProps) {
  const { sequence, flipped } = p;
  const rest = sequence.slice(flipped);
  const current = flipped > 0 ? sequence[flipped - 1] : undefined;
  const earlier = sequence.slice(0, Math.max(0, flipped - 1));
  const next = rest[0];
  const done = flipped >= sequence.length;
  const glow = next ? backGlow(next) : null;
  // Memoised: the moment restarts whenever its plan object changes.
  const plan = useMemo(
    () => (current ? momentPlan(current, p.reduced) : null),
    [current, p.reduced],
  );
  const [finished, setFinished] = useState<ReadonlySet<number>>(new Set());
  const [beat, setBeat] = useState<BeatAt | null>(null);
  const playing = plan !== null && current !== undefined && !finished.has(current.slot);
  const flip = useRef<HTMLDivElement>(null);
  const { onBusy } = p;
  useEffect(() => {
    onBusy?.(playing);
  }, [playing, onBusy]);
  // The card is hidden until its moment brings it in (Legendary / Mythic descend).
  const arrival = !playing
    ? 'landed'
    : !cardShown(plan, beat)
      ? 'waiting'
      : beat?.beat === 'descend'
        ? 'arriving'
        : 'landed';

  return (
    <div
      className="reveal"
      data-flipped={flipped}
      data-beat={playing ? (beat?.beat ?? 'none') : 'none'}
      data-reduced={p.reduced}
    >
      <div className="reveal__table">
        <div className="reveal__stack-slot">
          {next && (
            <button
              type="button"
              className="reveal__stack"
              data-glow={glow ?? 'none'}
              data-featured={next.featured}
              onClick={p.onFlip}
              disabled={p.auto}
              aria-label={`Flip the next card (${String(flipped + 1)} of ${String(sequence.length)})${next.featured ? ', the featured card' : ''}`}
              data-testid="card-stack"
            >
              {rest
                .slice(1)
                .reverse()
                .map((c) => (
                  <CardBack key={c.slot} className="reveal__under" />
                ))}
              <CardBack className="reveal__top" />
              {next.featured && <span className="reveal__featured">Featured</span>}
            </button>
          )}
        </div>

        <div className="reveal__spotlight" aria-live="polite">
          {current ? (
            <figure
              key={current.slot}
              className="reveal__card"
              data-rarity={current.rarity}
              data-variant={current.variant}
              data-arrival={arrival}
              data-moment={plan ? 'yes' : 'no'}
              style={
                plan
                  ? ({
                      '--descend-ms': `${String(plan.beats.find((b) => b.beat === 'descend')?.ms ?? 0)}ms`,
                    } as CSSProperties)
                  : undefined
              }
            >
              <div ref={flip} className="reveal__flip">
                <OpenedFace card={current} />
              </div>
              <figcaption className="reveal__caption">
                <span className="reveal__name">{catalogName(current)}</span>
                <span className={`rarity-tag rarity-tag--${current.rarity}`}>
                  {RARITY_NAME[current.rarity]}
                </span>
                <NewTag card={current} />
              </figcaption>
              <span className="visually-hidden">
                {cardFaceModel(openedSpec(current).card, openedSpec(current)).label}
              </span>
            </figure>
          ) : (
            <p className="reveal__prompt">Tap the stack to flip your first card.</p>
          )}
        </div>

        <ol className="reveal__tray" aria-label="Revealed cards">
          {earlier.map((c) => (
            <li key={c.slot} className="reveal__chip" data-rarity={c.rarity}>
              <span className="reveal__pip" aria-hidden="true" />
              <span>{catalogName(c)}</span>
              <NewTag card={c} />
            </li>
          ))}
        </ol>
      </div>

      {playing && (
        <RevealMoment
          key={current.slot}
          card={current}
          plan={plan}
          reduced={p.reduced}
          frozenAt={p.momentFrozenAt}
          target={() => flip.current}
          onBeat={setBeat}
          onDone={() => {
            setBeat(null);
            setFinished((f) => new Set(f).add(current.slot));
          }}
        />
      )}

      <div className="reveal__actions">
        {done ? (
          <Button onClick={p.onResults} disabled={playing}>
            See results
          </Button>
        ) : (
          <>
            <Button onClick={p.onFlip} disabled={p.auto || playing}>
              Flip
            </Button>
            <Button onClick={p.onRevealAll} disabled={p.auto || playing}>
              Reveal all
            </Button>
            <Button onClick={p.onSkip}>Skip</Button>
          </>
        )}
      </div>
    </div>
  );
}

const catalogName = (c: OpenedCard) => openedSpec(c).card.name;
