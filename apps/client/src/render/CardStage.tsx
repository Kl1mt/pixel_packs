import { useEffect, useRef, useState } from 'react';
import { CARD_FACE, CARD_SCALE } from '@pixel-packs/shared';
import { Card } from '../components/Card.js';
import { cardFaceModel } from '../components/cardFace.js';
import { useReducedMotion, useSettings } from '../settings/useSettings.js';
import type { CardSpec } from './cardView.js';
import { createStage, type Stage } from './stage.js';
import './cardStage.css';

export interface CardStageProps {
  specs: readonly CardSpec[];
  /** Integer screen px per art px. */
  scale?: number;
  columns?: number;
  /** Gap between cards in art px. */
  gap?: number;
  /** Force the reduced version; by default it follows motion and effects settings. */
  reduced?: boolean | undefined;
  /** Hold the shader clock at this many seconds (screenshots, tests). */
  frozenAt?: number | undefined;
  className?: string;
}

/** Reduced card effects: the in-game "reduce effects" or reduced motion (§18). */
export function useReducedCardEffects(): boolean {
  const { reduceEffects } = useSettings();
  return useReducedMotion() || reduceEffects;
}

const specsKey = (specs: readonly CardSpec[]) =>
  JSON.stringify(specs.map(({ card, ...o }) => [card.id, o]));

/**
 * Live Pixi cards (variant shaders) in one WebGL canvas. Falls back to the static
 * DOM `Card` when WebGL is unavailable. The canvas is decorative: the wrapper
 * carries each card's full label.
 */
export function CardStage({
  specs,
  scale = CARD_SCALE,
  columns,
  gap = 8,
  reduced,
  frozenAt,
  className,
}: CardStageProps) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<Stage | null>(null);
  const [failed, setFailed] = useState(false);
  const settingsReduced = useReducedCardEffects();
  const isReduced = reduced ?? settingsReduced;
  const reducedRef = useRef(isReduced);
  const key = specsKey(specs);
  const cols = Math.max(1, Math.min(columns ?? specs.length, specs.length));
  const rows = Math.ceil(specs.length / cols);
  const width = (cols * CARD_FACE.size.w + (cols - 1) * gap) * scale;
  const height = (rows * CARD_FACE.size.h + (rows - 1) * gap) * scale;

  // Before the build effect, so a new stage starts with the current setting.
  useEffect(() => {
    reducedRef.current = isReduced;
    stage.current?.setReduced(isReduced);
  }, [isReduced]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    let made: Stage | null = null;
    createStage(el, { specs, scale, columns: cols, gap, reduced: reducedRef.current, frozenAt })
      .then((s) => {
        if (cancelled) s.destroy();
        else stage.current = made = s;
      })
      .catch((err: unknown) => {
        console.warn('Card renderer unavailable, showing static cards', err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      made?.destroy();
      stage.current = null;
    };
    // `key` stands for `specs`; rebuilding on identity alone would churn GPU resources.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, scale, cols, gap, frozenAt]);

  const label = specs.map(({ card, ...o }) => cardFaceModel(card, o).label).join('; ');
  if (failed)
    return (
      <div className={['card-stage card-stage--static', className].filter(Boolean).join(' ')}>
        {specs.map(({ card, ...o }, i) => (
          <Card key={i} card={card} {...o} />
        ))}
      </div>
    );
  return (
    <div
      ref={host}
      role="img"
      aria-label={label}
      className={['card-stage', className].filter(Boolean).join(' ')}
      data-cards={specs.length}
      style={{ width, height }}
    />
  );
}
