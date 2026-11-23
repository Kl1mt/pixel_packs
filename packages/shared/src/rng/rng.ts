/** Source of uniform random integers. Every rule takes one, so tests can seed it. */
export interface Rng {
  /** Uniform integer in [0, maxExclusive). `maxExclusive` is a positive safe integer ≤ 2^32. */
  int(maxExclusive: number): number;
}

const UINT32 = 0x1_0000_0000;

function checkMax(maxExclusive: number): void {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > UINT32) {
    throw new RangeError(`Rng.int: bad maxExclusive ${maxExclusive}`);
  }
}

/** Unbiased draw from a uint32 source by rejection sampling. */
function intFromUint32(next: () => number, maxExclusive: number): number {
  checkMax(maxExclusive);
  const limit = UINT32 - (UINT32 % maxExclusive);
  for (;;) {
    const x = next();
    if (x < limit) return x % maxExclusive;
  }
}

/** Hashes a string seed to four 32-bit words (cyrb128). */
function seedWords(seed: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/**
 * Deterministic RNG (sfc32 seeded via cyrb128). Same seed → same sequence on every
 * platform. Used for battles (M4) and tests; never for packs.
 */
export function createSeededRng(seed: string | number): Rng {
  let [a, b, c, d] = seedWords(String(seed));
  const next = (): number => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };
  // Discard the first outputs, as recommended for sfc32.
  for (let i = 0; i < 15; i++) next();
  return { int: (maxExclusive) => intFromUint32(next, maxExclusive) };
}

interface WebCryptoLike {
  getRandomValues<T extends Uint32Array>(array: T): T;
}

/**
 * Cryptographically secure RNG via Web Crypto (Node 22 and browsers).
 * Packs roll with this on the server (GDD §5).
 */
export function createCryptoRng(): Rng {
  const webCrypto = (globalThis as { crypto?: WebCryptoLike }).crypto;
  if (!webCrypto) throw new Error('createCryptoRng: Web Crypto is not available');
  const buf = new Uint32Array(64);
  let pos = buf.length;
  const next = (): number => {
    if (pos >= buf.length) {
      webCrypto.getRandomValues(buf);
      pos = 0;
    }
    return buf[pos++] ?? 0;
  };
  return { int: (maxExclusive) => intFromUint32(next, maxExclusive) };
}
