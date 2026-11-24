import { CARD_SCALE } from '@pixel-packs/shared';
import { Card } from '../components/Card.js';
import { Tilt } from '../components/Tilt.js';
import type { CardSpec } from '../render/cardView.js';
import { LiveCard } from './LiveCard.js';

/**
 * The inspected copy as a live shader card (GDD §12 "3D tilt with the card's shader").
 * The pointer tilts it and steers the foil light; reduced motion keeps it flat.
 */
export function TiltCard({ spec, frozenAt }: { spec: CardSpec; frozenAt?: number | undefined }) {
  const { card, ...look } = spec;
  return (
    <Tilt className="tilt--inspect">
      <LiveCard
        specs={[spec]}
        scale={CARD_SCALE}
        frozenAt={frozenAt}
        className="tilt__stage"
        fallback={<Card card={card} {...look} />}
      />
    </Tilt>
  );
}
