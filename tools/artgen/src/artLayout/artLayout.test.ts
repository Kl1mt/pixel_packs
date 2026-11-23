import { describe, expect, it } from 'vitest';
import { CARD_ART_DROP } from '@pixel-packs/shared';
import { measureArtDrops } from './artLayout.js';

describe('art layout', () => {
  it('CARD_ART_DROP matches the committed card PNGs (re-run `artgen art-layout` if not)', async () => {
    expect(CARD_ART_DROP).toEqual(await measureArtDrops());
  });
});
