/** `#rrggbb` → `[r, g, b]` in 0–1, for shader uniforms. */
export function glslRgb(hex: string): Float32Array {
  const n = Number.parseInt(hex.slice(1), 16);
  return new Float32Array([(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255));
}
