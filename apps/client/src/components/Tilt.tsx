import { useState, type CSSProperties, type ReactNode } from 'react';
import { useReducedMotion } from '../settings/useSettings.js';

/** Largest tilt in degrees; the card rests flat (at exact integer scale) when the pointer leaves. */
export const MAX_TILT = 8;

/** The tilt for a pointer at (px, py), each −0.5…0.5 from the box centre. */
export const tiltAt = (px: number, py: number) => ({ x: -py * 2 * MAX_TILT, y: px * 2 * MAX_TILT });

export interface TiltProps {
  children: ReactNode;
  className?: string | undefined;
  /** Keeps the card flat, e.g. while a reveal moment is drawn around it. */
  disabled?: boolean | undefined;
}

/**
 * A card that leans towards the pointer (GDD §12 "3D tilt", T15; the reveal too since
 * T22): at most 8°, flat at rest, and never under reduced motion.
 */
export function Tilt({ children, className, disabled }: TiltProps) {
  const reduced = useReducedMotion();
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const still = reduced || disabled === true;
  const shown = still ? { x: 0, y: 0 } : tilt;
  const style = {
    '--tilt-x': `${shown.x.toFixed(2)}deg`,
    '--tilt-y': `${shown.y.toFixed(2)}deg`,
  } as CSSProperties;
  return (
    <div
      className={className ? `tilt ${className}` : 'tilt'}
      data-tilting={shown.x !== 0 || shown.y !== 0 ? 'true' : undefined}
      onPointerMove={(e) => {
        if (still) return;
        const r = e.currentTarget.getBoundingClientRect();
        setTilt(tiltAt((e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5));
      }}
      onPointerLeave={() => {
        setTilt({ x: 0, y: 0 });
      }}
    >
      <div className="tilt__card" style={style}>
        {children}
      </div>
    </div>
  );
}
