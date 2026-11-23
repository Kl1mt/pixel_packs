import { describe, expect, it } from 'vitest';
import { isUsernameBlocked } from './usernameBlocklist.js';

describe('test-player username tags', () => {
  it('base-36 tags can hit the blocklist, hex tags never do', () => {
    // A real base-36 timestamp tag can read as a blocked word ("5lut" → "slut").
    expect(isUsernameBlocked('p_m5lut1')).toBe(true);
    // Every hex digit sequence stays clear: try every 4-character hex window.
    for (let i = 0; i < 0x10000; i++) {
      const tag = i.toString(16).padStart(4, '0');
      expect(isUsernameBlocked(`p_${tag}${tag}`)).toBe(false);
    }
  });
});
