import { describe, expect, it } from 'vitest';
import { CARD_ART_STYLE_SUFFIX, cardArtPrompt } from './prompt.js';

describe('cardArtPrompt', () => {
  it('wraps a critter description in the fixed §19 template', () => {
    expect(cardArtPrompt('a tiny snail.')).toBe(`a tiny snail, ${CARD_ART_STYLE_SUFFIX}`);
    expect(CARD_ART_STYLE_SUFFIX).toContain('transparent background');
    expect(CARD_ART_STYLE_SUFFIX).toMatch(/no scenery$/);
  });

  it('rejects an empty description', () => {
    expect(() => cardArtPrompt('  ')).toThrow();
  });
});
