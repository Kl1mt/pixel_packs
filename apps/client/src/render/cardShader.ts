import { GLSL_CONSTANTS } from './glsl.js';

/**
 * The card shader (GDD §6). It draws the 96×128 face composite (art + frame) as
 * one quad and works on whole art pixels: `p = floor(uv * SIZE)`, so every effect
 * stays on the card's pixel grid at any integer scale. Pixels an effect changes
 * are snapped to the nearest master-palette colour (§16: palette-only art).
 *
 * Variants (uVariant = variantRank): 0 normal · 1 foil · 2 prismatic · 3 void · 4 glitch.
 * uReduced = 1 is the reduced-effects version (§18): no flicker, flashes or
 * jitter; foil only follows the pointer; prismatic and void hold still.
 */
export const CARD_VERTEX = `
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
}
`;

export const CARD_FRAGMENT = `
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uTime;
uniform float uVariant;
uniform float uReduced;
uniform float uLight;
uniform float uSeed;
uniform vec3 uSky;
uniform vec3 uGround;
${GLSL_CONSTANTS}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed * 7.31) * 43758.5453);
}

bool inText(vec2 p) {
  return p.x >= TEXT_AREA.x && p.y >= TEXT_AREA.y && p.x < TEXT_AREA.x + TEXT_AREA.z
    && p.y < TEXT_AREA.y + TEXT_AREA.w;
}

bool inWin(vec2 p) {
  return p.x >= WIN.x && p.y >= WIN.y && p.x < WIN.x + WIN.z && p.y < WIN.y + WIN.w;
}

/** Composite (premultiplied) at art pixel p; transparent outside the card. */
vec4 src(vec2 p) {
  if (p.x < 0.0 || p.y < 0.0 || p.x >= SIZE.x || p.y >= SIZE.y) return vec4(0.0);
  return texture(uTexture, (p + 0.5) / SIZE);
}

vec3 backdrop(vec2 p) {
  return (p.y - WIN.y) < SKY_ROWS ? uSky : uGround;
}

/** Straight-alpha colour at p, with the realm backdrop behind the art window. */
vec4 face(vec2 p) {
  vec4 c = src(p);
  vec3 rgb = c.a > 0.0 ? c.rgb / c.a : vec3(0.0);
  if (inWin(p)) return vec4(mix(backdrop(p), rgb, c.a), 1.0);
  return vec4(rgb, c.a);
}

vec3 snapPalette(vec3 c) {
  vec3 best = uPalette[0];
  float bd = 1e9;
  for (int i = 0; i < PALETTE_N; i++) {
    vec3 d = c - uPalette[i];
    float dd = dot(d * vec3(0.30, 0.59, 0.11), d);
    if (dd < bd) { bd = dd; best = uPalette[i]; }
  }
  return best;
}

float edgeDist(vec2 p) {
  return min(min(p.x, p.y), min(SIZE.x - 1.0 - p.x, SIZE.y - 1.0 - p.y));
}

// Foil: a stepped diagonal light band (core + soft edge + trailing glint).
// uLight is the band's position on the diagonal d = x + y/2, set by the CPU
// (auto sweep, or under the pointer).
vec4 foil(vec2 p, vec4 c) {
  float d = p.x + floor(p.y * 0.5);
  float k = abs(d - uLight);
  float a = k < 2.0 ? 0.55 : (k < 6.0 ? 0.3 : 0.0);
  if (abs(d - (uLight - 13.0)) < 1.0) a = max(a, 0.3);
  return vec4(mix(c.rgb, GLOW, a), c.a);
}

vec3 rainbow(float h) {
  return 0.5 + 0.5 * cos(6.2832 * (h + vec3(0.0, 0.33, 0.67)));
}

// Prismatic: a moving rainbow on the frame and backdrop (the critter keeps its
// colours) plus twinkling plus-shaped sparkles.
vec4 prismatic(vec2 p, vec4 c, bool art, float t) {
  float h = (p.x + p.y) * 0.012 - t * 0.25;
  float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  vec3 tint = rainbow(h) * (0.3 + lum * 0.95);
  vec3 rgb = c.rgb;
  if (inText(p)) return c;
  if (!inWin(p)) rgb = mix(rgb, tint, 0.8);
  else if (!art) rgb = mix(rgb, rainbow(h) * 0.9 + 0.1, 0.22);
  // Sparkles: one per 8×8 cell, blinking at its own phase.
  vec2 cell = floor(p / 8.0);
  vec2 sp = cell * 8.0 + 1.0 + floor(vec2(hash(cell), hash(cell + 31.0)) * 6.0);
  float phase = fract(t * 0.6 + hash(cell + 7.0));
  bool on = uReduced > 0.5 ? hash(cell + 13.0) < 0.2 : phase < 0.22;
  bool big = uReduced < 0.5 && phase < 0.1;
  vec2 q = abs(p - sp);
  if (on && c.a > 0.0) {
    if (q.x + q.y == 0.0) rgb = GLOW;
    else if (big && q.x + q.y == 1.0) rgb = MOONLIGHT;
  }
  return vec4(rgb, c.a);
}

// Void: a starfield replaces the backdrop, the outer edge ripples in purple,
// and motes drift inward to the window's centre.
vec4 voidFx(vec2 p, bool art, float t, bool full) {
  vec4 c = face(p);
  vec3 rgb = c.rgb;
  float e = edgeDist(p);
  if (e < 3.0 && c.a > 0.0) {
    float along = p.x + p.y;
    float wave = full ? sin(along * 0.45 - t * 3.0) : 0.0;
    if (e < 1.0 && wave > 0.55) {
      // Warp: pull the silhouette in by one pixel on wave crests.
      vec2 n = p.x < 1.0 ? vec2(-1.0, 0.0) : p.y < 1.0 ? vec2(0.0, -1.0)
        : p.x > SIZE.x - 2.0 ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      c = face(p - n);
      rgb = c.rgb;
    }
    float tint = full ? 0.45 + 0.3 * wave : 0.45;
    rgb = mix(rgb, e < 1.0 ? PERIWINKLE : LILAC, tint);
  }
  if (inWin(p) && !art) {
    vec2 w = p - WIN.xy;
    float drift = full ? floor(t * 1.5) : 0.0;
    vec2 sp = vec2(mod(w.x + drift, WIN.z), w.y);
    rgb = w.y < SKY_ROWS ? NIGHT : INK;
    float h = hash(sp);
    if (h > 0.965) {
      float tw = full ? fract(t * 0.5 + hash(sp + 3.0)) : 0.0;
      rgb = h > 0.99 ? MOONLIGHT : (tw < 0.7 ? LAVENDER : INDIGO);
    }
    float rim = min(min(w.x, w.y), min(WIN.z - 1.0 - w.x, WIN.w - 1.0 - w.y));
    if (rim < 1.0) rgb = mix(rgb, PERIWINKLE, full ? 0.5 + 0.3 * sin(t * 2.0 + w.x * 0.2) : 0.5);
  }
  if (full && inWin(p)) {
    vec2 centre = WIN.xy + WIN.zw * 0.5;
    for (int i = 0; i < 10; i++) {
      float fi = float(i);
      float life = fract(t * 0.22 + hash(vec2(fi, 1.0)));
      float ang = hash(vec2(fi, 2.0)) * 6.2832 + life * 1.6;
      float r = (1.0 - life) * 34.0;
      vec2 head = floor(centre + vec2(cos(ang), sin(ang)) * r);
      vec2 tail = floor(centre + vec2(cos(ang - 0.05), sin(ang - 0.05)) * (r + 2.0));
      if (p == head) rgb = LAVENDER;
      else if (p == tail && life < 0.9) rgb = LILAC;
    }
  }
  return vec4(rgb, c.a);
}

// Glitch: RGB split, scanlines, row jitter in bursts and a rare corrupt frame
// (blocks swapped, channels rotated).
vec4 glitch(vec2 p, float t, bool full) {
  if (inText(p)) return face(p);
  float split = 1.0;
  vec2 q = p;
  bool corrupt = false;
  if (full) {
    float burst = step(0.8, hash(vec2(floor(t * 7.0), 3.0)));
    split += burst;
    float band = floor(p.y / 3.0);
    float slot = floor(t * 14.0);
    if (burst > 0.0 && hash(vec2(band, slot)) > 0.7)
      q.x += floor(hash(vec2(band + 9.0, slot)) * 7.0) - 3.0;
    float cycle = floor(t / 4.5);
    if (fract(t / 4.5) * 4.5 < 0.16 && hash(vec2(cycle, 5.0)) > 0.25) {
      vec2 block = floor(p / 8.0);
      if (hash(block + cycle) > 0.62) {
        corrupt = true;
        q += floor(vec2(hash(block + 1.0 + cycle), hash(block + 2.0 + cycle)) * 3.0 - 1.0) * 8.0;
      }
    }
  }
  vec4 r = face(q - vec2(split, 0.0));
  vec4 g = face(q);
  vec4 b = face(q + vec2(split, 0.0));
  vec3 rgb = vec3(r.r, g.g, b.b);
  float a = max(g.a, max(r.a, b.a));
  if (corrupt) rgb = rgb.gbr;
  if (mod(p.y, 2.0) > 0.5) rgb *= 0.85;
  if (full && p.y == floor(mod(t * 40.0, SIZE.y + 40.0)) - 20.0) rgb = mix(rgb, GLOW, 0.4);
  return vec4(rgb, a);
}

void main() {
  vec2 p = floor(vUV * SIZE);
  bool full = uReduced < 0.5;
  float t = full ? uTime : 0.0;
  vec4 raw = src(p);
  bool art = inWin(p) && raw.a > 0.0;
  vec4 c = face(p);
  vec4 o = c;
  if (uVariant > 0.5 && uVariant < 1.5) o = foil(p, c);
  else if (uVariant < 2.5 && uVariant > 1.5) o = prismatic(p, c, art, t);
  else if (uVariant < 3.5 && uVariant > 2.5) o = voidFx(p, art, t, full);
  else if (uVariant > 3.5) o = glitch(p, t, full);
  if (o.a > 0.0 && distance(o.rgb, c.rgb) > 0.004) o.rgb = snapPalette(o.rgb);
  finalColor = vec4(o.rgb * o.a, o.a);
}
`;
