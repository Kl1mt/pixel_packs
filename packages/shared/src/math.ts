/**
 * Clamps `value` into the inclusive integer range [min, max].
 * Non-integer input is truncated toward zero first. Throws if the range is empty.
 */
export function clampInt(value: number, min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    throw new RangeError('clampInt: min and max must be integers');
  }
  if (min > max) {
    throw new RangeError(`clampInt: empty range [${min}, ${max}]`);
  }
  if (Number.isNaN(value)) {
    throw new RangeError('clampInt: value is NaN');
  }
  // `+ 0` normalises -0 (e.g. from Math.trunc(-0.5)) to 0.
  return Math.min(max, Math.max(min, Math.trunc(value))) + 0;
}
