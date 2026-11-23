import type { PityMeter as Meter } from '@pixel-packs/shared';
import { pityProgress } from './format.js';

const SEGMENTS = 20;

/** The visible pity meter (GDD §5): a row of pixel segments filling towards the guarantee. */
export function PityMeter({ meter }: { meter: Meter }) {
  const { left, fill } = pityProgress(meter);
  const lit = Math.round(fill * SEGMENTS);
  return (
    <div className="pity" data-left={left}>
      <p className="pity__label">
        {left === 1
          ? 'Your next realm pack brings a Legendary or better.'
          : `Legendary or better within ${String(left)} realm packs.`}
      </p>
      <div
        className="pity__bar"
        role="meter"
        aria-label="Legendary guarantee"
        aria-valuemin={0}
        aria-valuemax={meter.legendaryHardPity}
        aria-valuenow={meter.packsSinceLegendaryPlus}
        aria-valuetext={`${String(meter.packsSinceLegendaryPlus)} of ${String(meter.legendaryHardPity)} packs`}
      >
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span key={i} className={i < lit ? 'pity__seg is-lit' : 'pity__seg'} />
        ))}
      </div>
    </div>
  );
}
