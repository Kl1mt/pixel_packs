import { useState, type CSSProperties } from 'react';
import { CARD_SCALE } from '@pixel-packs/shared';
import { Card } from '../components/Card.js';
import type { CardSpec } from '../render/cardView.js';
import { useReducedMotion } from '../settings/useSettings.js';
import { LiveCard } from './LiveCard.js';

/** Largest tilt in degrees; the card rests flat (at exact integer scale) when the pointer leaves. */
const MAX_TILT = 8;

/**
 * The inspected copy as a live shader card (GDD §12 "3D tilt with the card's shader").
 * The pointer tilts it and steers the foil light; reduced motion keeps it flat.
 */
export function TiltCard({ spec, frozenAt }: { spec: CardSpec; frozenAt?: number | undefined }) {
  const reduced = useReducedMotion();
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const style = {
    '--tilt-x': `${tilt.x.toFixed(2)}deg`,
    '--tilt-y': `${tilt.y.toFixed(2)}deg`,
  } as CSSProperties;
  const { card, ...look } = spec;
  return (
    <div
      className="tilt"
      data-tilting={tilt.x !== 0 || tilt.y !== 0 ? 'true' : undefined}
      onPointerMove={(e) => {
        if (reduced) return;
        const r = e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        setTilt({ x: -py * 2 * MAX_TILT, y: px * 2 * MAX_TILT });
      }}
      onPointerLeave={() => {
        setTilt({ x: 0, y: 0 });
      }}
    >
      <div className="tilt__card" style={style}>
        <LiveCard
          specs={[spec]}
          scale={CARD_SCALE}
          frozenAt={frozenAt}
          className="tilt__stage"
          fallback={<Card card={card} {...look} />}
        />
      </div>
    </div>
  );
}
