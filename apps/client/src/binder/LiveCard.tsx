import { lazy, Suspense } from 'react';
import type { CardStageProps } from '../render/CardStage.js';

// Pixi stays out of the binder's first load: it arrives with the first live card.
const CardStage = lazy(() =>
  import('../render/CardStage.js').then((m) => ({ default: m.CardStage })),
);

/** A lazily loaded `CardStage`; renders `fallback` (usually nothing) until Pixi is in. */
export function LiveCard({
  fallback = null,
  ...props
}: CardStageProps & { fallback?: React.ReactNode }) {
  return (
    <Suspense fallback={fallback}>
      <CardStage {...props} />
    </Suspense>
  );
}
