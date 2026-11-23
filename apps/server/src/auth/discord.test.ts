import { describe, expect, it } from 'vitest';
import { createDiscordClient, usernameBaseFromDiscord, usernameCandidate } from './discord.js';

const cfg = { clientId: '42', clientSecret: 'shh', redirectUri: 'http://app.test/cb' };

describe('usernameBaseFromDiscord', () => {
  it('keeps allowed characters and trims to 20', () => {
    expect(usernameBaseFromDiscord('mossy.fox')).toBe('mossyfox');
    expect(usernameBaseFromDiscord('a_very_long_discord_handle_indeed')).toBe(
      'a_very_long_discord_',
    );
  });

  it('pads short names and avoids blocked ones', () => {
    expect(usernameBaseFromDiscord('ab')).toBe('ab_pal');
    expect(usernameBaseFromDiscord('..')).toBe('pal');
    expect(usernameBaseFromDiscord('admin')).toBe('critter');
  });

  it('tags later candidates with four digits', () => {
    expect(usernameCandidate('mossyfox', 0, () => 0.5)).toBe('mossyfox');
    expect(usernameCandidate('a_very_long_discord_', 1, () => 0.0123)).toBe('a_very_long_dis_0123');
  });
});

describe('createDiscordClient', () => {
  it('builds the authorize URL with state, scopes and redirect', () => {
    const url = new URL(createDiscordClient(cfg).authorizeUrl('st'));
    expect(url.origin + url.pathname).toBe('https://discord.com/oauth2/authorize');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: '42',
      scope: 'identify email',
      redirect_uri: 'http://app.test/cb',
      state: 'st',
      response_type: 'code',
    });
  });

  it('exchanges the code and reads the identity', async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const fetchFn: typeof fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      calls.push({ url, init });
      const body = url.endsWith('/oauth2/token')
        ? { access_token: 'tok', token_type: 'Bearer' }
        : {
            id: '123',
            username: 'mossy.fox',
            global_name: 'Mossy',
            email: 'm@x.io',
            verified: true,
          };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    };
    const id = await createDiscordClient(cfg, fetchFn).exchange('code1');
    expect(id).toEqual({
      id: '123',
      username: 'mossy.fox',
      displayName: 'Mossy',
      email: 'm@x.io',
      emailVerified: true,
    });
    const tokenBody = calls[0]?.init?.body;
    expect(tokenBody).toBeInstanceOf(URLSearchParams);
    expect((tokenBody as URLSearchParams).get('code')).toBe('code1');
    expect(new Headers(calls[1]?.init?.headers).get('authorization')).toBe('Bearer tok');
  });

  it('throws when Discord refuses the code', async () => {
    const fetchFn: typeof fetch = () => Promise.resolve(new Response('{}', { status: 400 }));
    await expect(createDiscordClient(cfg, fetchFn).exchange('bad')).rejects.toThrow('HTTP 400');
  });
});
