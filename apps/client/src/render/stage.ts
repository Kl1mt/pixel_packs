import { Application, RendererType } from 'pixi.js';
import { CARD_FACE } from '@pixel-packs/shared';
import { CardView, type CardSpec } from './cardView.js';

export interface StageOptions {
  specs: readonly CardSpec[];
  scale: number;
  columns: number;
  /** Gap between cards in art px. */
  gap: number;
  reduced: boolean;
  /** Hold the shader clock at this many seconds (deterministic screenshots). */
  frozenAt?: number | undefined;
}

export interface Stage {
  readonly app: Application;
  readonly views: readonly CardView[];
  setReduced(reduced: boolean): void;
  destroy(): void;
}

/**
 * A WebGL Pixi application with a grid of `CardView`s, its canvas appended to
 * `host`. WebGL only: the card shader is GLSL (no WebGPU/canvas fallback; the
 * caller shows DOM cards if this throws).
 */
export async function createStage(host: HTMLElement, o: StageOptions): Promise<Stage> {
  const { w, h } = CARD_FACE.size;
  const rows = Math.ceil(o.specs.length / o.columns);
  const app = new Application();
  await app.init({
    preference: 'webgl',
    width: (o.columns * w + (o.columns - 1) * o.gap) * o.scale,
    height: (rows * h + (rows - 1) * o.gap) * o.scale,
    backgroundAlpha: 0,
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    // Rendered on demand below: a stage of still cards costs nothing per frame.
    autoStart: false,
  });
  if (app.renderer.type !== (RendererType.WEBGL as number)) {
    app.destroy(true);
    throw new Error('WebGL renderer unavailable');
  }
  let views: CardView[];
  try {
    views = await Promise.all(
      o.specs.map((spec, i) =>
        CardView.create(spec, { scale: o.scale, reduced: o.reduced, seed: i + 1 }),
      ),
    );
  } catch (err) {
    app.destroy(true);
    throw err;
  }
  views.forEach((v, i) => {
    v.root.position.set(
      (i % o.columns) * (w + o.gap) * o.scale,
      Math.floor(i / o.columns) * (h + o.gap) * o.scale,
    );
    app.stage.addChild(v.root);
  });

  const canvas = app.canvas;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.imageRendering = 'pixelated';
  host.appendChild(canvas);

  const start = performance.now();
  let raf = 0;
  const frame = (now: number) => {
    const t = o.frozenAt ?? (now - start) / 1000;
    let changed = false;
    for (const v of views) changed = v.update(t, app.renderer) || changed;
    if (changed) {
      app.render();
      host.dataset.ready = 'true';
    }
    raf = requestAnimationFrame(frame);
  };
  app.ticker.stop();
  raf = requestAnimationFrame(frame);

  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const ax = (e.clientX - r.left) / o.scale;
    const ay = (e.clientY - r.top) / o.scale;
    const col = Math.floor(ax / (w + o.gap));
    const row = Math.floor(ay / (h + o.gap));
    const lx = ax - col * (w + o.gap);
    const ly = ay - row * (h + o.gap);
    const hit = lx < w && ly < h && col < o.columns ? row * o.columns + col : -1;
    views.forEach((v, i) => {
      v.setPointer(i === hit ? { x: lx, y: ly } : null);
    });
  };
  const onLeave = () => {
    for (const v of views) v.setPointer(null);
  };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);

  return {
    app,
    views,
    setReduced(reduced) {
      for (const v of views) v.setReduced(reduced);
    },
    destroy() {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(raf);
      for (const v of views) v.destroy();
      app.destroy(true, { children: true });
    },
  };
}
