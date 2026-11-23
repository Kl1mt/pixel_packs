import type { WeightTable } from '../config/odds.js';
import type { Rng } from '../rng/rng.js';

/** Non-zero entries of a weight table, in insertion order. */
export function weightEntries<K extends string>(table: WeightTable<K>): [K, number][] {
  const entries: [K, number][] = [];
  for (const key of Object.keys(table) as K[]) {
    const w = table[key] ?? 0;
    if (!Number.isInteger(w) || w < 0) throw new RangeError(`bad weight for ${key}: ${w}`);
    if (w > 0) entries.push([key, w]);
  }
  return entries;
}

export function totalWeight<K extends string>(table: WeightTable<K>): number {
  return weightEntries(table).reduce((sum, [, w]) => sum + w, 0);
}

/** Picks a key with probability `weight / total`, using one `rng.int(total)` draw. */
export function pickWeighted<K extends string>(rng: Rng, table: WeightTable<K>): K {
  const entries = weightEntries(table);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  if (total === 0) throw new RangeError('pickWeighted: empty table');
  let r = rng.int(total);
  for (const [key, w] of entries) {
    if (r < w) return key;
    r -= w;
  }
  throw new Error('unreachable');
}

/** Uniform pick from a non-empty list. */
export function pickOne<T>(rng: Rng, items: readonly T[]): T {
  const item = items[rng.int(items.length)];
  if (item === undefined) throw new RangeError('pickOne: empty list');
  return item;
}
