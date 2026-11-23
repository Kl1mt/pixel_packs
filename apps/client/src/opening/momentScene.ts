import { crestBurst, cutscene, fallbackCrest, type RealmArt } from './cutscenes.js';
import { beatAt, type Beat, type BeatAt, type MomentPlan } from './moment.js';
import {
  C,
  centre,
  dim,
  foilGlint,
  glitchNoise,
  godRays,
  rainbowWash,
  shockwave,
  sparkle,
  voidImplosion,
  type Rect,
} from './momentFx.js';
import { PixelBuffer, seeded } from './pixels.js';

/** The frame each beat holds under reduced effects (the most telling one). */
const STILL_K: Partial<Record<Beat, number>> = {
  rays: 1,
  crest: 0.15,
  cutscene: 0.85,
  shockwave: 0.35,
  foil: 0.45,
  void: 0.55,
};

export interface MomentSceneOptions {
  plan: MomentPlan;
  art: RealmArt;
  reduced: boolean;
  /** Integer screen px per art px (the card scale, so effect pixels match card pixels). */
  scale: number;
  /** The spotlight card's box in CSS px, relative to the canvases. */
  cardBox: () => DOMRect | null;
  /** Hold one moment of the timeline (ms) for screenshots instead of playing. */
  frozenAt?: number | undefined;
  onBeat: (at: BeatAt | null) => void;
  onDone: () => void;
}

/**
 * Plays a `MomentPlan` on two pixel canvases: `back` sits under the spotlight card
 * (dimming, god-rays, the Mythic takeover), `front` over it (crest burst, stingers).
 * Each frame is drawn into a framebuffer of art px and blitted at the integer scale.
 */
export class MomentScene {
  private back: PixelBuffer = new PixelBuffer(1, 1);
  private front: PixelBuffer = new PixelBuffer(1, 1);
  private readonly bctx: CanvasRenderingContext2D;
  private readonly fctx: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;
  private clock = 0;
  private beat = -1;
  private done = false;

  constructor(
    private readonly backCanvas: HTMLCanvasElement,
    private readonly frontCanvas: HTMLCanvasElement,
    private readonly o: MomentSceneOptions,
  ) {
    const b = backCanvas.getContext('2d');
    const f = frontCanvas.getContext('2d');
    if (!b || !f) throw new Error('2D canvas unavailable');
    this.bctx = b;
    this.fctx = f;
    if (o.frozenAt !== undefined) this.clock = o.frozenAt;
    this.raf = requestAnimationFrame(this.frame);
  }

  resize(cssW: number, cssH: number): void {
    const s = this.o.scale;
    const w = Math.max(1, Math.ceil(cssW / s));
    const h = Math.max(1, Math.ceil(cssH / s));
    this.back = new PixelBuffer(w, h);
    this.front = new PixelBuffer(w, h);
    for (const c of [this.backCanvas, this.frontCanvas]) {
      c.width = w;
      c.height = h;
      c.style.width = `${String(w * s)}px`;
      c.style.height = `${String(h * s)}px`;
    }
  }

  /** Jumps to the end (the player tapped to skip). */
  skip(): void {
    this.clock = this.o.plan.ms;
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
  }

  private readonly frame = (now: number) => {
    const dt = this.last === 0 ? 0 : Math.min(50, now - this.last);
    this.last = now;
    if (this.o.frozenAt === undefined) this.clock += dt;
    const at = beatAt(this.o.plan, this.clock);
    const index = at?.index ?? this.o.plan.beats.length;
    if (index !== this.beat) {
      this.beat = index;
      this.o.onBeat(at);
    }
    if (at === null) {
      this.clear();
      if (!this.done) {
        this.done = true;
        this.o.onDone();
      }
      return;
    }
    this.draw(at);
    this.raf = requestAnimationFrame(this.frame);
  };

  private clear(): void {
    this.bctx.clearRect(0, 0, this.back.w, this.back.h);
    this.fctx.clearRect(0, 0, this.front.w, this.front.h);
  }

  /** The card's box in art px on the framebuffer. */
  private card(): Rect {
    const b = this.o.cardBox();
    const s = this.o.scale;
    if (!b)
      return {
        x: Math.floor(this.back.w / 2) - 48,
        y: Math.floor(this.back.h / 2) - 64,
        w: 96,
        h: 128,
      };
    return { x: Math.round(b.left / s), y: Math.round(b.top / s), w: 96, h: 128 };
  }

  private draw(at: BeatAt): void {
    const { back, front, o } = this;
    back.clear();
    front.clear();
    const card = this.card();
    const c = centre(card);
    const still = o.reduced;
    // Reduced effects show each beat as one representative still frame.
    const k = still ? (STILL_K[at.beat] ?? 0.5) : at.k;
    const t = still ? 0 : this.clock;
    const beats = o.plan.beats.map((b) => b.beat);
    const legendary = beats.includes('rays');
    const mythic = beats.includes('cutscene');
    const crest = o.art.crest ?? fallbackCrest(o.plan.realm);

    switch (at.beat) {
      case 'dim':
        dim(back, 0.25 + 0.5 * k);
        break;
      case 'rays':
        dim(back, 0.75);
        godRays(back, { x: c.x, y: card.y - 30 }, 30 + k * 260, t / 2600, Math.min(1, k * 1.5));
        break;
      case 'descend':
        if (mythic) dim(back, 1 - 0.6 * k, C.night);
        else dim(back, 0.75);
        if (legendary) godRays(back, { x: c.x, y: card.y - 30 }, 290, t / 2600, 1);
        else godRays(back, { x: c.x, y: card.y - 30 }, 60 + k * 200, t / 2600, k);
        this.trail(front, card, at.k);
        break;
      case 'crest':
        dim(back, (mythic ? 0.4 : 0.75) * (1 - k));
        godRays(back, { x: c.x, y: card.y - 30 }, 290, t / 2600, 1 - k);
        crestBurst(front, crest, c, k);
        break;
      case 'takeover': {
        // Night floods out from the middle in a stepped diamond.
        const r = Math.round(k * (back.w + back.h) * 0.6);
        for (let y = 0; y < back.h; y++)
          for (let x = 0; x < back.w; x++) {
            const d = Math.abs(x - back.w / 2) + Math.abs(y - back.h / 2);
            if (d < r) back.set(x, y, d > r - 3 ? C.lavender : C.night);
          }
        break;
      }
      case 'freeze':
        dim(back, 1, C.night);
        this.freeze(back, k, still);
        break;
      case 'cutscene':
        cutscene(back, o.plan.realm, k, this.clock, still, o.art);
        break;
      case 'shockwave':
        shockwave(back, k);
        break;
      case 'foil':
        foilGlint(front, card, k);
        break;
      case 'prismatic':
        rainbowWash(front, card, k, t);
        break;
      case 'void':
        voidImplosion(back, front, card, k);
        break;
      case 'glitch':
        glitchNoise(front, card, k, still ? 0 : Math.floor(this.clock / 70));
        break;
    }
    this.blit();
  }

  /** Slow-mo sparkles trailing the descending card. */
  private trail(buf: PixelBuffer, card: Rect, k: number): void {
    if (this.o.reduced) return;
    const rnd = seeded(Math.floor(this.clock / 120));
    for (let i = 0; i < 6; i++)
      sparkle(
        buf,
        card.x - 6 + rnd() * (card.w + 12),
        card.y - 4 + rnd() * card.h * (1 - k),
        1,
        C.sunflower,
      );
  }

  /** Time stops: twelve ticks light up around the centre, frozen motes hang in the air. */
  private freeze(buf: PixelBuffer, k: number, still: boolean): void {
    const cx = buf.w / 2;
    const cy = buf.h / 2;
    const rnd = seeded(12);
    for (let i = 0; i < 60; i++)
      buf.set(rnd() * buf.w, rnd() * buf.h, i % 3 ? C.lavender : C.sunflower);
    const lit = still ? 12 : Math.floor(k * 13);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const col = i < lit ? C.glow : C.indigo;
      for (let d = 30; d < 36; d++) buf.set(cx + Math.cos(a) * d, cy + Math.sin(a) * d, col);
    }
    const hand = (still ? 0.5 : k) * Math.PI * 2 - Math.PI / 2;
    for (let d = 0; d < 26; d++)
      buf.set(cx + Math.cos(hand) * d, cy + Math.sin(hand) * d, C.moonlight);
  }

  private blit(): void {
    for (const [ctx, buf] of [
      [this.bctx, this.back],
      [this.fctx, this.front],
    ] as const) {
      const img = new ImageData(buf.bytes, buf.w, buf.h);
      ctx.putImageData(img, 0, 0);
    }
  }
}
