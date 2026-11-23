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

  it('enables Discord only when both credentials are set', () => {
    expect(loadConfig({}).discord).toBeNull();
    expect(loadConfig({ DISCORD_CLIENT_ID: '123', DISCORD_CLIENT_SECRET: ' ' }).discord).toBeNull();
    expect(
      loadConfig({ DISCORD_CLIENT_ID: '123', DISCORD_CLIENT_SECRET: 's3cret' }).discord,
    ).toEqual({
      clientId: '123',
      clientSecret: 's3cret',
      redirectUri: 'http://localhost:5173/api/auth/discord/callback',
    });
  });

  it('only lets rate limits be switched off outside production', () => {
    expect(loadConfig({}).RATE_LIMIT).toBe(true);
    expect(loadConfig({ RATE_LIMIT: 'false' }).RATE_LIMIT).toBe(false);
    expect(loadConfig({ NODE_ENV: 'production', RATE_LIMIT: 'false' }).RATE_LIMIT).toBe(true);
  });
});
