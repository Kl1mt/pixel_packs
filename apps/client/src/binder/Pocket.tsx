import { useEffect, useState, type CSSProperties } from 'react';
import { CARD_ART_DROP, type BinderSlot, type CollectionCopy } from '@pixel-packs/shared';
import { Card } from '../components/Card.js';
import { cardFaceModel } from '../components/cardFace.js';
import { copySpec } from './copyText.js';
import { LiveCard } from './LiveCard.js';

/** Hover-capable pointer (desktop): only there does hovering a card make it live. */
const canHover = () => window.matchMedia('(hover: hover)').matches;

/** Delay before a hovered card goes live, so sweeping the mouse across a page stays cheap. */
const LIVE_DELAY_MS = 120;

export interface PocketProps {
  slot: BinderSlot;
  scale: number;
  onOpen: (cardId: string) => void;
}

/**
 * One binder pocket (GDD §12): the best copy as a static DOM card with a still
 * variant overlay and a "×n" stack tag, or a silhouette for a missing card. Only a
 * hovered or focused variant copy mounts the live shader (§18), one at a time.
 */
export function Pocket({ slot, scale, onOpen }: PocketProps) {
  const { card, copies } = slot;
  const best: CollectionCopy | undefined = copies[0];
  const [hot, setHot] = useState(false);
  const [live, setLive] = useState(false);
  const special = best !== undefined && best.variant !== 'normal';
  const cool = () => {
    setHot(false);
    setLive(false);
  };

  useEffect(() => {
    if (!hot || !special) return;
    const t = window.setTimeout(() => {
      setLive(true);
    }, LIVE_DELAY_MS);
    return () => {
      window.clearTimeout(t);
    };
  }, [hot, special]);

  const size = { '--pocket-scale': scale } as CSSProperties;
  if (!best)
    return (
      <div
        className="pocket pocket--missing"
        style={size}
        role="img"
        aria-label={`${card.id}, a ${card.rarity} card you have not found yet`}
        data-card={card.id}
      >
        <div
          className="pocket__silhouette"
          style={
            {
              maskImage: `url(/assets/cards/${card.id}.png)`,
              '--drop': CARD_ART_DROP[card.id] ?? 0,
            } as CSSProperties
          }
        />
        <span className="pocket__id">{card.id}</span>
      </div>
    );

  const spec = copySpec(card, best);
  const label = cardFaceModel(card, spec).label;
  const count = copies.length > 1 ? `, ${String(copies.length)} copies` : '';
  return (
    <div
      className="pocket pocket--owned"
      style={size}
      data-card={card.id}
      data-variant={best.variant}
      onPointerEnter={() => {
        if (canHover()) setHot(true);
      }}
      onPointerLeave={cool}
    >
      <div aria-hidden="true">
        <Card {...spec} scale={scale} className="pocket__card" />
        {special && !live && <span className={`pocket__sheen pocket__sheen--${best.variant}`} />}
        {live && <LiveCard specs={[spec]} scale={scale} className="pocket__live" />}
        {copies.length > 1 && <span className="pocket__count num">×{copies.length}</span>}
      </div>
      <button
        type="button"
        className="pocket__hit"
        aria-label={`${label}${count}. Inspect`}
        onClick={() => {
          onOpen(card.id);
        }}
        onFocus={() => {
          setHot(true);
        }}
        onBlur={cool}
      />
    </div>
  );
}
