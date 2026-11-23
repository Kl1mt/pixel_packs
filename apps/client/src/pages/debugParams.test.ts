import { describe, expect, it } from 'vitest';
import { debugSpec, parseDebugParams } from './debugParams.js';

describe('debug page params', () => {
  it('falls back to defaults for missing or broken values', () => {
    const p = parseDebugParams(new URLSearchParams('card=NOPE&variant=gold&stars=7&mint=-3'));
    expect(p).toEqual({
      card: 'MOS-012',
      variant: 'foil',
      stars: 1,
      edition: 0,
      mint: 12,
      fx: 'settings',
      stress: 0,
      all: 1,
      freeze: -1,
    });
  });

  it('builds the copy, with mint numbers only on Void and Glitch', () => {
    const p = parseDebugParams(
      new URLSearchParams('card=STA-003&variant=void&stars=3&edition=1&mint=40'),
    );
    expect(debugSpec(p)).toMatchObject({
      variant: 'void',
      stars: 3,
      edition: { season: 1 },
      mintNumber: 40,
    });
    expect(debugSpec(p, 'foil').mintNumber).toBeNull();
    expect(debugSpec(p).card.id).toBe('STA-003');
  });
});
