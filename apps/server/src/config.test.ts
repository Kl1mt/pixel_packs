import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('applies defaults', () => {
    const c = loadConfig({});
    expect(c.PORT).toBe(3001);
    expect(c.DATABASE_URL).toBeUndefined();
  });

  it('treats an empty DATABASE_URL as unset', () => {
    expect(loadConfig({ DATABASE_URL: '  ' }).DATABASE_URL).toBeUndefined();
  });

  it('rejects an invalid port', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow();
  });
});
