import { describe, expect, it } from 'vitest';
import { OAuthOutcomeSchema } from '@pixel-packs/shared';
import { OAUTH_MESSAGES, oauthMessage, safeNext } from './messages.js';

describe('oauthMessage', () => {
  it('has copy for every outcome', () => {
    for (const o of OAuthOutcomeSchema.options) expect(OAUTH_MESSAGES[o].length).toBeGreaterThan(0);
  });

  it('ignores unknown values', () => {
    expect(oauthMessage(null)).toBeNull();
    expect(oauthMessage('<script>')).toBeNull();
    expect(oauthMessage('denied')?.outcome).toBe('denied');
  });
});

describe('safeNext', () => {
  it('keeps same-site paths only', () => {
    expect(safeNext('/binder?x=1')).toBe('/binder?x=1');
    expect(safeNext(null)).toBe('/');
    expect(safeNext('//evil.example')).toBe('/');
    expect(safeNext('/\\evil.example')).toBe('/');
    expect(safeNext('https://evil.example')).toBe('/');
  });
});
