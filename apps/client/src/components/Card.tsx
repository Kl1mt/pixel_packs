import type { CSSProperties } from 'react';
import { CARD_FACE, CARD_SCALE, type Card as CatalogCard, type Rect } from '@pixel-packs/shared';
import { cardFaceModel, faceText, type CardFaceOverrides } from './cardFace.js';

/** Absolute position of a `CARD_FACE` rect, in art px times `--card`. */
const at = (r: Rect): CSSProperties => ({
  left: `calc(${String(r.x)}px * var(--card))`,
  top: `calc(${String(r.y)}px * var(--card))`,
  width: `calc(${String(r.w)}px * var(--card))`,
  height: `calc(${String(r.h)}px * var(--card))`,
});

export interface CardProps extends CardFaceOverrides {
  card: CatalogCard;
  className?: string;
  /** Integer screen px per art px; below `CARD_SCALE` the face drops its rules text. */
  scale?: number;
}

/**
 * DOM card face at `CARD_SCALE` (GDD §4): realm backdrop, bottom-aligned art,
 * rarity frame (material + pips), name, compact rules text and chunky ATK/HP
 * digits, plus star / edition / mint badges. This is the static card: the
 * animated variant shaders live in the Pixi renderer (`src/render/`), which
 * draws the same model.
 */
export function Card({ card, className, scale = CARD_SCALE, ...overrides }: CardProps) {
  const m = cardFaceModel(card, overrides);
  const text = faceText(m, scale);
  const { w, h } = CARD_FACE.size;
  return (
    <figure
      className={['card', className].filter(Boolean).join(' ')}
      aria-label={m.label}
      data-rarity={m.rarity}
      data-variant={m.variant}
      style={
        {
          '--bd-sky': m.backdrop[0],
          '--bd-ground': m.backdrop[1],
          ...(scale === CARD_SCALE ? {} : { '--card': scale }),
        } as CSSProperties
      }
    >
      <div className="card__backdrop" style={at(CARD_FACE.art)} />
      <div className="card__art" style={at(CARD_FACE.art)}>
        <img
          src={m.art}
          alt=""
          draggable={false}
          style={{ transform: `translateY(calc(${String(m.artDrop)}px * var(--card)))` }}
        />
      </div>
      <img className="card__frame" src={m.frame} alt="" draggable={false} />
      {text.name && (
        <div
          className="card__name"
          style={{ ...at(CARD_FACE.name), fontSize: `${String(text.nameSize)}px` }}
          aria-hidden="true"
        >
          {m.name}
        </div>
      )}
      {text.rules && (
        <div
          className="card__rules"
          style={{ ...at(CARD_FACE.rules), fontSize: m.rulesSize }}
          aria-hidden="true"
        >
          {m.rules.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      )}
      <svg
        className="card__overlay"
        viewBox={`0 0 ${String(w)} ${String(h)}`}
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        {m.statPixels.map((p) => (
          <rect key={`${String(p.x)},${String(p.y)}`} x={p.x} y={p.y} width={1} height={1} />
        ))}
        {m.badgePixels.map((p, i) => (
          <rect key={`b${String(i)}`} x={p.x} y={p.y} width={1} height={1} fill={p.colour} />
        ))}
      </svg>
    </figure>
  );
}

/** The shared card back at `CARD_SCALE`. */
export function CardBack({ className }: { className?: string }) {
  return (
    <figure className={['card', className].filter(Boolean).join(' ')} aria-label="Card back">
      <img className="card__frame" src="/assets/frames/back.png" alt="" draggable={false} />
    </figure>
  );
}
