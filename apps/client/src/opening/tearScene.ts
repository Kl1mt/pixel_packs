import { MASTER_PALETTE as P } from '@pixel-packs/shared';
import { MythicSeal } from './mythicSeal.js';
import { packMask } from './packMask.js';
import { ambientPetal, burstPetal, petalPixels, stepPetals, type Petal } from './petals.js';
import { claspPixels, Stardust } from './starhollow.js';
import { SEAM_REACH, SeamTear, TEAR_DONE } from './tear.js';
import type { PackMood } from './reveal.js';
import { vineFront, type PackTheme, type WrapPixel } from './themes.js';

export interface TearSceneOptions {
  theme: PackTheme;
  packImage: HTMLImageElement;
  /** Epic or better: the pack shakes and light leaks through the tear (GDD §5). */
  mood: PackMood;
  reduced: boolean;
  /** Called as the seam tears (0–1). */
  onProgress: (p: number) => void;
  /** The pack has burst open; the cards are next. */
  onTorn: () => void;
}

const PACK = 64;
const BURST_MS = 700;
const BURST_MS_REDUCED = 250;
/** Half-widths of the mound rows under the pack. */
const MOUND = [24, 29, 31, 30, 27, 21] as const;
const LEAK: Record<TearSceneOptions['mood'], readonly string[]> = {
  calm: [P.glow, P.cream],
  epic: [P.lavender, P.lilac],
  golden: [P.sunflower, P.amber],
  mythic: [P.sunflower, P.rose],
};

/**
 * The tear moment on one 2D canvas at an integer pixel scale (GDD §16): the pack
 * sprite, the theme's wrapping, the tear along the seam, light and petals. Every
 * pixel lands on the art grid; the canvas is scaled up with `pixelated`.
 */
export class TearScene {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly seam: SeamTear;
  private readonly wrap: WrapPixel[];
  private petals: Petal[] = [];
  private w = 0;
  private h = 0;
  private scale = 1;
  private raf = 0;
  private last = 0;
  private clock = 0;
  private dragX: number | null = null;
  private downAt: { x: number; y: number } | null = null;
  private autoFrom: number | null = null;
  private burstAt: number | null = null;
  private torn = false;
  private spawn = 0;
  private readonly dust: Stardust | null;
  private readonly seal: MythicSeal | null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly o: TearSceneOptions,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
    this.seam = new SeamTear(o.theme.seam.x0, o.theme.seam.x1);
    this.wrap = o.theme.wrap(packMask(o.packImage));
    this.dust = o.theme.stardust > 0 ? new Stardust(o.theme.stardust, Math.random) : null;
    this.seal = o.theme.seal ? new MythicSeal(o.packImage, o.theme.seal, PACK) : null;
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    this.raf = requestAnimationFrame(this.frame);
  }

  /** Fits the canvas to its host in whole art pixels. */
  resize(cssW: number, cssH: number, scale: number): void {
    this.scale = scale;
    this.w = Math.ceil(cssW / scale);
    this.h = Math.ceil(cssH / scale);
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.canvas.style.width = `${String(this.w * scale)}px`;
    this.canvas.style.height = `${String(this.h * scale)}px`;
    this.ctx.imageSmoothingEnabled = false;
    // Start mid-drift, so the scene is never empty.
    if (this.petals.length === 0 && !this.o.reduced)
      for (let i = 0; i < this.o.theme.ambient * 3; i++) {
        const p = ambientPetal(this.w, this.o.theme.petals, Math.random);
        this.petals.push({ ...p, y: Math.random() * this.h, age: Math.random() * 3 });
      }
  }

  /** The click / keyboard fallback: the seam rips from left to right by itself. */
  autoTear(): void {
    if (this.autoFrom === null && this.burstAt === null) this.autoFrom = this.clock;
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onUp);
  }

  /** Top-left of the pack on the canvas, in art px. */
  private get origin(): { x: number; y: number } {
    return { x: Math.floor((this.w - PACK) / 2), y: Math.floor((this.h - PACK) / 2) };
  }

  private local(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    const o = this.origin;
    return {
      x: (e.clientX - r.left) / this.scale - o.x,
      y: (e.clientY - r.top) / this.scale - o.y,
    };
  }

  private readonly onDown = (e: PointerEvent) => {
    if (this.burstAt !== null) return;
    const p = this.local(e);
    this.downAt = p;
    this.dragX = Math.abs(p.y - this.o.theme.seam.y) <= SEAM_REACH ? p.x : null;
    this.canvas.setPointerCapture(e.pointerId);
  };

  private readonly onMove = (e: PointerEvent) => {
    if (this.downAt === null || this.burstAt !== null) return;
    const p = this.local(e);
    const near = Math.abs(p.y - this.o.theme.seam.y) <= SEAM_REACH;
    if (near && this.dragX !== null) this.seam.drag(this.dragX, p.x);
    this.dragX = near ? p.x : null;
    this.progressed();
  };

  private readonly onUp = (e: PointerEvent) => {
    const start = this.downAt;
    this.downAt = null;
    this.dragX = null;
    if (start === null) return;
    const p = this.local(e);
    const moved = Math.hypot(p.x - start.x, p.y - start.y);
    const onPack = p.x >= 0 && p.x < PACK && p.y >= 0 && p.y < PACK;
    // A plain click on the pack is the click fallback.
    if (moved < 3 && onPack && this.seam.progress < 0.1) this.autoTear();
  };

  private progressed(): void {
    this.o.onProgress(this.seam.progress);
    if (this.seam.progress >= TEAR_DONE && this.burstAt === null) {
      this.seam.tearTo(1);
      this.burstAt = this.clock;
      const o = this.origin;
      const s = this.o.theme.seam;
      const r = Math.random;
      for (let i = 0; i < (this.o.reduced ? 0 : this.o.theme.burst); i++)
        this.petals.push(
          burstPetal(o.x + s.x0 + r() * (s.x1 - s.x0), o.y + s.y, this.o.theme.petals, r),
        );
    }
  }

  private readonly frame = (now: number) => {
    const dt = this.last === 0 ? 0 : Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.clock += dt * 1000;
    if (this.autoFrom !== null && this.burstAt === null) {
      this.seam.tearTo(this.o.reduced ? 1 : (this.clock - this.autoFrom) / this.o.theme.autoTearMs);
      this.progressed();
    }
    const burstMs = this.o.reduced ? BURST_MS_REDUCED : BURST_MS;
    if (this.burstAt !== null && !this.torn && this.clock - this.burstAt >= burstMs) {
      this.torn = true;
      this.o.onTorn();
    }
    this.stepParticles(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };

  private stepParticles(dt: number): void {
    const t = this.o.theme;
    if (!this.o.reduced && t.petals.length > 0) {
      this.spawn += dt * t.ambient;
      while (this.spawn >= 1) {
        this.spawn -= 1;
        this.petals.push(ambientPetal(this.w, t.petals, Math.random));
      }
    }
    this.petals = stepPetals(this.petals, dt, this.h + 2);
    if (!this.o.reduced) this.dust?.step(dt, this.seam.progress, this.burstK());
  }

  /** How far the burst has played (0–1), or null before it. */
  private burstK(): number | null {
    if (this.burstAt === null) return null;
    return Math.min(
      1,
      (this.clock - this.burstAt) / (this.o.reduced ? BURST_MS_REDUCED : BURST_MS),
    );
  }

  private stardust(o: { x: number; y: number }, back: boolean): void {
    if (!this.dust) return;
    for (const d of this.dust.pixels(o.x + 32, o.y + 34, back, this.burstK()))
      this.px(d.x, d.y, d.colour);
  }

  private px(x: number, y: number, colour: string): void {
    this.ctx.fillStyle = colour;
    this.ctx.fillRect(x, y, 1, 1);
  }

  private draw(): void {
    const { ctx, o: opts } = this;
    const { seam } = opts.theme;
    ctx.clearRect(0, 0, this.w, this.h);
    const since = this.burstAt === null ? 0 : this.clock - this.burstAt;
    const k =
      this.burstAt === null ? 0 : Math.min(1, since / (opts.reduced ? BURST_MS_REDUCED : BURST_MS));
    // Epic+ packs shake now and then; a Mythic one harder and more often.
    const big = opts.mood === 'mythic' ? 2 : 1;
    const shake =
      opts.mood !== 'calm' &&
      !opts.reduced &&
      this.burstAt === null &&
      this.clock % (1600 / big) < 220
        ? ((Math.floor(this.clock / 50) % 2) * 2 - 1) * big
        : 0;
    const o = { x: this.origin.x + shake, y: this.origin.y };
    const img = opts.packImage;

    // Light rising from the opened pack, in stepped columns.
    if (k > 0) {
      const leak = LEAK[opts.mood];
      const rise = Math.round(k * 40);
      for (let x = seam.x0 + 2; x <= seam.x1 - 2; x += 4)
        for (let dy = 1; dy <= rise - ((x * 7) % 9); dy++)
          this.px(o.x + x, o.y + seam.y - dy, leak[dy % 6 < 3 ? 0 : 1] ?? P.glow);
    }

    // The mossy mound the pack sits on.
    const ground = opts.theme.ground;
    if (ground)
      MOUND.forEach((half, dy) => {
        for (let dx = -half; dx < half; dx++)
          this.px(
            this.origin.x + 32 + dx,
            this.origin.y + 53 + dy,
            dy === 0 ? ground[0] : ground[1],
          );
      });

    // The pack below the seam, and the top flap flying off once it bursts.
    this.stardust(o, true);
    const cut = seam.y + 1;
    const body = this.seal?.body ?? img;
    ctx.drawImage(body, 0, cut, PACK, PACK - cut, o.x, o.y + cut, PACK, PACK - cut);
    if (this.seal)
      for (const c of this.seal.pixels(this.seam.progress, this.clock, this.burstK(), opts.reduced))
        this.px(o.x + c.x, o.y + c.y, c.colour);
    if (opts.theme.clasp)
      for (const c of claspPixels(this.seam.progress / TEAR_DONE, k > 0))
        this.px(o.x + c.x, o.y + c.y, c.colour);
    if (k < 1) {
      ctx.globalAlpha = k === 0 ? 1 : ([1, 0.66, 0.33][Math.min(2, Math.floor(k * 3))] ?? 0);
      const lift = Math.round(k * k * 18);
      ctx.drawImage(img, 0, 0, PACK, cut, o.x - Math.round(k * 3), o.y - lift, PACK, cut);
      ctx.globalAlpha = 1;
    }

    // The tear: a jagged dark line with light showing through, flickering for big packs.
    const leak = LEAK[opts.mood];
    for (let x = seam.x0; x <= seam.x1; x++) {
      if (!this.seam.isTorn(x)) continue;
      const jag = [0, 1, 0, -1][x % 4] ?? 0;
      this.px(o.x + x, o.y + seam.y + jag, P.ink);
      if (opts.mood !== 'calm' && (opts.reduced || (x + Math.floor(this.clock / 120)) % 3 !== 0))
        this.px(o.x + x, o.y + seam.y + jag - 1, leak[x % 2] ?? P.glow);
    }

    // Before the first tear, glinting stitches show where to drag.
    if (this.seam.progress === 0 && this.autoFrom === null) {
      const lit = Math.floor(this.clock / 90) % (seam.x1 - seam.x0 + 12);
      for (let x = seam.x0; x <= seam.x1; x += 2)
        this.px(o.x + x, o.y + seam.y, Math.abs(x - seam.x0 - lit) < 3 ? P.glow : P.straw);
    }

    // The wrapping unwinds as the seam tears.
    const p = this.burstAt === null ? this.seam.progress / TEAR_DONE : 1;
    for (const w of this.wrap)
      if (w.t >= vineFront(opts.theme, w.vine, p) && !(p >= 1 && k > 0))
        this.px(o.x + w.x, o.y + w.y, w.colour);

    this.stardust(o, false);
    for (const petal of this.petals)
      for (const [x, y, colour] of petalPixels(petal)) this.px(x, y, colour);
  }
}
