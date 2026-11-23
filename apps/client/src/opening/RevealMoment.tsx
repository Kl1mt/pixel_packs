import { useEffect, useRef, useState } from 'react';
import { CARD_SCALE, type OpenedCard, type Realm } from '@pixel-packs/shared';
import { spriteFrom, type RealmArt } from './cutscenes.js';
import { GLITCH_TEXT, momentLabel, type BeatAt, type MomentPlan } from './moment.js';
import { MomentScene } from './momentScene.js';
import './moment.css';

/** Generated moment art in `public/assets/moments/` (T13); missing art is drawn in code. */
const MOMENT_ART: Partial<Record<Realm, { crest?: string; vignette?: string }>> = {};

const loadSprite = async (src: string | undefined) => {
  if (!src) return null;
  const img = new Image();
  img.src = src;
  try {
    await img.decode();
    return spriteFrom(img);
  } catch {
    return null;
  }
};

async function loadArt(realm: Realm): Promise<RealmArt> {
  const a = MOMENT_ART[realm] ?? {};
  const [crest, vignette] = await Promise.all([loadSprite(a.crest), loadSprite(a.vignette)]);
  return { crest, vignette };
}

export interface RevealMomentProps {
  card: Pick<OpenedCard, 'rarity' | 'variant' | 'realm'>;
  plan: MomentPlan;
  reduced: boolean;
  /** The spotlight card's element: effects line up with it. */
  target: () => HTMLElement | null;
  /** Hold the timeline at this many ms (screenshots); plays live otherwise. */
  frozenAt?: number | undefined;
  onBeat: (at: BeatAt | null) => void;
  onDone: () => void;
}

/**
 * A Legendary / Mythic reveal and the variant stinger (GDD §5, §6), drawn on two pixel
 * canvases around the spotlight card. A tap anywhere (or the button) skips it.
 */
export function RevealMoment(p: RevealMomentProps) {
  const back = useRef<HTMLCanvasElement>(null);
  const front = useRef<HTMLCanvasElement>(null);
  const scene = useRef<MomentScene | null>(null);
  const skipBtn = useRef<HTMLButtonElement>(null);
  const [beat, setBeat] = useState<BeatAt | null>(null);
  const cb = useRef(p);
  useEffect(() => {
    cb.current = p;
  });

  useEffect(() => {
    const b = back.current;
    const f = front.current;
    if (!b || !f) return;
    let live = true;
    let made: MomentScene | null = null;
    const fit = () => {
      made?.resize(window.innerWidth, window.innerHeight);
    };
    void loadArt(p.plan.realm).then((art) => {
      if (!live) return;
      made = scene.current = new MomentScene(b, f, {
        plan: p.plan,
        art,
        reduced: p.reduced,
        scale: CARD_SCALE,
        frozenAt: p.frozenAt,
        cardBox: () => {
          const el = cb.current.target();
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const o = b.getBoundingClientRect();
          return new DOMRect(r.left - o.left, r.top - o.top, r.width, r.height);
        },
        onBeat: (at) => {
          setBeat(at);
          cb.current.onBeat(at);
        },
        onDone: () => {
          cb.current.onDone();
        },
      });
      fit();
    });
    window.addEventListener('resize', fit);
    skipBtn.current?.focus();
    return () => {
      live = false;
      window.removeEventListener('resize', fit);
      made?.destroy();
      scene.current = null;
    };
  }, [p.plan, p.reduced, p.frozenAt]);

  const skip = () => {
    scene.current?.skip();
  };
  return (
    <>
      {/* Under the spotlight card, so dimming and rays sit behind it. */}
      <canvas ref={back} className="moment__layer moment__layer--back" aria-hidden="true" />
      <div className="moment" data-beat={beat?.beat ?? 'none'} data-testid="moment" onClick={skip}>
        <canvas ref={front} className="moment__layer moment__layer--front" aria-hidden="true" />
        {beat?.beat === 'glitch' && (
          <p className="moment__err" aria-hidden="true">
            {GLITCH_TEXT}
          </p>
        )}
        <p className="visually-hidden" aria-live="polite">
          {momentLabel(p.card)}
        </p>
        <button ref={skipBtn} type="button" className="moment__skip" onClick={skip}>
          Skip animation
        </button>
      </div>
    </>
  );
}
