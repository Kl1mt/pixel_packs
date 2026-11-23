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

  it('turns secure cookies on in production unless overridden', () => {
    expect(loadConfig({}).COOKIE_SECURE).toBe(false);
    expect(loadConfig({ NODE_ENV: 'production' }).COOKIE_SECURE).toBe(true);
    expect(loadConfig({ NODE_ENV: 'production', COOKIE_SECURE: 'false' }).COOKIE_SECURE).toBe(
      false,
    );
  });
});
