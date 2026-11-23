import {
  type Renderer,
  Container,
  Geometry,
  GlProgram,
  Graphics,
  Mesh,
  RenderTexture,
  Shader,
  Sprite,
  Text,
  Texture,
  UniformGroup,
} from 'pixi.js';
import { CARD_FACE, MASTER_PALETTE, variantRank, type Card } from '@pixel-packs/shared';
import {
  cardFaceModel,
  faceText,
  type CardFaceModel,
  type CardFaceOverrides,
} from '../components/cardFace.js';
import { FONT_STACKS } from '../design/tokens.js';
import { CARD_FRAGMENT, CARD_VERTEX } from './cardShader.js';
import { glslRgb } from './colour.js';
import { PALETTE_SIZE, PALETTE_UNIFORM } from './glsl.js';
import { foilLight } from './motion.js';

/** One card to draw: the catalog card plus the copy's look (variant, stars, badges). */
export interface CardSpec extends CardFaceOverrides {
  card: Card;
}

export interface CardViewOptions {
  /** Integer screen px per art px (default `CARD_SCALE` is the caller's job). */
  scale: number;
  /** Reduced-effects version of the variant shader (§18). */
  reduced: boolean;
  /** Varies sparkle and glitch patterns between cards on one stage. */
  seed?: number;
}

const { w: W, h: H } = CARD_FACE.size;

function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  return img.decode().then(() => img);
}

/** Art (bottom-aligned, clipped to the window) under the rarity frame, at 1 canvas px per art px. */
async function composite(m: CardFaceModel): Promise<HTMLCanvasElement> {
  const [art, frame] = await Promise.all([loadImage(m.art), loadImage(m.frame)]);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  const a = CARD_FACE.art;
  ctx.save();
  ctx.beginPath();
  ctx.rect(a.x, a.y, a.w, a.h);
  ctx.clip();
  ctx.drawImage(art, a.x, a.y + m.artDrop);
  ctx.restore();
  ctx.drawImage(frame, 0, 0);
  return canvas;
}

let program: GlProgram | null = null;
const cardProgram = () =>
  (program ??= GlProgram.from({ vertex: CARD_VERTEX, fragment: CARD_FRAGMENT, name: 'card' }));

/**
 * A Pixi card that matches the DOM `Card` (same `cardFaceModel`): the pixel
 * layers (art, frame, digits, badges) at `scale`, the variant shader on art and
 * frame, and the name and rules text on top at screen resolution.
 * Used by the debug page now and by binder, inspect and reveal later (T12/T15).
 */
export class CardView {
  readonly root = new Container();
  readonly model: CardFaceModel;
  private readonly uniforms: UniformGroup;
  private readonly texture: Texture;
  private readonly shader: Shader;
  private readonly mesh: Mesh<Geometry, Shader>;
  /** The shaded face at 1 texel per art px, shown scaled with nearest sampling. */
  private readonly rt: RenderTexture;
  private dirty = true;
  private pointer: { x: number; y: number } | null = null;
  private light = -40;

  private constructor(
    model: CardFaceModel,
    canvas: HTMLCanvasElement,
    private opts: CardViewOptions,
  ) {
    this.model = model;
    const s = opts.scale;
    this.texture = Texture.from(canvas);
    this.texture.source.scaleMode = 'nearest';
    this.uniforms = new UniformGroup({
      uTime: { value: 0, type: 'f32' },
      uVariant: { value: variantRank(model.variant), type: 'f32' },
      uReduced: { value: opts.reduced ? 1 : 0, type: 'f32' },
      uLight: { value: this.light, type: 'f32' },
      uSeed: { value: opts.seed ?? 0, type: 'f32' },
      uSky: { value: glslRgb(model.backdrop[0]), type: 'vec3<f32>' },
      uGround: { value: glslRgb(model.backdrop[1]), type: 'vec3<f32>' },
      uPalette: { value: PALETTE_UNIFORM, type: 'vec3<f32>', size: PALETTE_SIZE },
    });
    const geometry = new Geometry({
      attributes: {
        aPosition: [0, 0, W, 0, W, H, 0, H],
        aUV: [0, 0, 1, 0, 1, 1, 0, 1],
      },
      indexBuffer: [0, 1, 2, 0, 2, 3],
    });
    const shader = (this.shader = new Shader({
      glProgram: cardProgram(),
      resources: { uTexture: this.texture.source, cardUniforms: this.uniforms },
    }));
    this.mesh = new Mesh({ geometry, shader });
    this.rt = RenderTexture.create({ width: W, height: H, resolution: 1, scaleMode: 'nearest' });
    const pixels = new Container();
    pixels.scale.set(s);
    pixels.addChild(new Sprite(this.rt), this.overlay());
    this.root.addChild(pixels, ...this.text());
  }

  static async create(spec: CardSpec, opts: CardViewOptions): Promise<CardView> {
    const { card, ...overrides } = spec;
    const model = cardFaceModel(card, overrides);
    return new CardView(model, await composite(model), opts);
  }

  /** Stat digits and badges, unaffected by the shader so they stay legible. */
  private overlay(): Graphics {
    const g = new Graphics();
    for (const p of this.model.statPixels) g.rect(p.x, p.y, 1, 1);
    g.fill(MASTER_PALETTE.ink);
    for (const p of this.model.badgePixels) g.rect(p.x, p.y, 1, 1).fill(p.colour);
    return g;
  }

  private text(): Text[] {
    const s = this.opts.scale;
    const face = faceText(this.model, s);
    const n = CARD_FACE.name;
    const r = CARD_FACE.rules;
    const name = new Text({
      text: this.model.name,
      style: {
        fontFamily: FONT_STACKS.body,
        fontWeight: 'bold',
        fontSize: face.nameSize,
        fill: MASTER_PALETTE.ink,
      },
    });
    name.anchor.set(0.5);
    name.position.set((n.x + n.w / 2) * s, (n.y + n.h / 2) * s);
    const rules = new Text({
      text: this.model.rules.join('\n'),
      style: {
        fontFamily: FONT_STACKS.body,
        fontSize: 13,
        lineHeight: 13 * 1.25,
        align: 'center',
        wordWrap: true,
        wordWrapWidth: r.w * s,
        fill: MASTER_PALETTE.ink,
      },
    });
    rules.anchor.set(0.5);
    rules.position.set((r.x + r.w / 2) * s, (r.y + r.h / 2) * s);
    return [...(face.name ? [name] : []), ...(face.rules ? [rules] : [])];
  }

  /** Pointer in art px over the card, or null when it leaves (foil follows it). */
  setPointer(p: { x: number; y: number } | null): void {
    this.pointer = p;
  }

  setReduced(reduced: boolean): void {
    this.opts = { ...this.opts, reduced };
    this.uniforms.uniforms.uReduced = reduced ? 1 : 0;
    this.dirty = true;
  }

  /** True when the face changes over time (full-effects shimmer, sweeps, glitches). */
  private get animated(): boolean {
    return this.model.variant !== 'normal' && !this.opts.reduced;
  }

  /**
   * Advance the shader clock (seconds since the stage started) and re-shade the
   * face into its 96×128 texture when anything changed. Static faces (normal, or
   * reduced without a moving foil band) cost nothing per frame.
   * Returns true when the face was re-shaded, i.e. the stage needs a redraw.
   */
  update(time: number, renderer: Renderer): boolean {
    const u = this.uniforms.uniforms as { uTime: number; uLight: number };
    const light = foilLight(this.light, time, this.pointer, this.opts.reduced);
    if (light !== this.light && this.model.variant === 'foil') this.dirty = true;
    this.light = light;
    if (!this.dirty && !this.animated) return false;
    u.uTime = time;
    u.uLight = light;
    renderer.render({ container: this.mesh, target: this.rt, clear: true });
    this.dirty = false;
    return true;
  }

  destroy(): void {
    this.root.destroy({ children: true });
    this.mesh.destroy();
    this.shader.destroy();
    this.rt.destroy(true);
    this.texture.destroy(true);
  }
}
