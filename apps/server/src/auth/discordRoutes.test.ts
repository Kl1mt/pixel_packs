import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LinkedAccountsResponseSchema, UserResponseSchema } from '@pixel-packs/shared';
import type { DiscordClient, DiscordIdentity } from './discord.js';
import { Client, createTestApp, tokenFromMail, type TestApp } from '../testing/harness.js';

/** A fake Discord: codes map straight to identities. */
const identities = new Map<string, DiscordIdentity>();
const fakeDiscord: DiscordClient = {
  authorizeUrl: (state) => `https://discord.test/authorize?state=${state}`,
  exchange: (code) => {
    const id = identities.get(code);
    return id ? Promise.resolve(id) : Promise.reject(new Error('bad code'));
  },
};

let n = 0;
function discordUser(over: Partial<DiscordIdentity> = {}): string {
  n += 1;
  const code = `code${n}`;
  identities.set(code, {
    id: String(900000 + n),
    username: `fox.${n}`,
    displayName: `Fox ${n}`,
    email: `fox${n}@discord.test`,
    emailVerified: true,
    ...over,
  });
  return code;
}

let t: TestApp;
let off: TestApp;
beforeAll(async () => {
  [t, off] = await Promise.all([createTestApp({ discord: fakeDiscord }), createTestApp()]);
});
afterAll(() => Promise.all([t.close(), off.close()]));

async function viaDiscord(c: Client, code: string, mode: 'login' | 'link' = 'login') {
  const start = await c.get(`/api/auth/discord/start?mode=${mode}`);
  expect(start.statusCode).toBe(302);
  const location = start.headers.location ?? '';
  if (!location.startsWith('https://discord.test/')) return start;
  const state = new URL(location).searchParams.get('state') ?? '';
  return c.get(`/api/auth/discord/callback?code=${code}&state=${state}`);
}

const me = async (c: Client) => UserResponseSchema.parse((await c.get('/api/auth/me')).json()).user;
const linked = async (c: Client) =>
  LinkedAccountsResponseSchema.parse((await c.get('/api/auth/linked')).json());

async function passwordUser(email: string, username: string, verify: boolean) {
  const c = new Client(t.app);
  await c.csrf();
  const res = await c.post('/api/auth/register', {
    email,
    username,
    password: 'correct horse battery',
  });
  expect(res.statusCode).toBe(201);
  if (verify) {
    const token = tokenFromMail(t.mail.findLast((m) => m.to === email));
    expect((await c.post('/api/auth/verify-email', { token })).statusCode).toBe(204);
  }
  return c;
}

describe('without credentials', () => {
  it('reports Discord as off and 404s its routes', async () => {
    const c = new Client(off.app);
    expect((await c.get('/api/auth/providers')).json()).toEqual({ discord: false });
    expect((await c.get('/api/auth/discord/start')).statusCode).toBe(404);
    expect((await c.get('/api/auth/discord/callback?code=x&state=y')).statusCode).toBe(404);
  });
});

describe('Discord login', () => {
  it('signs up a new player, then logs the same player in again', async () => {
    expect((await new Client(t.app).get('/api/auth/providers')).json()).toEqual({ discord: true });
    const code = discordUser({ username: 'mossy.fox' });
    const c = new Client(t.app);
    const res = await viaDiscord(c, code);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('http://app.test/');
    const user = await me(c);
    expect(user).toMatchObject({ username: 'mossyfox', emailVerified: true });
    const l = await linked(c);
    expect(l.hasPassword).toBe(false);
    expect(l.discord?.username).toMatch(/^Fox \d+$/);
    const economy = (await c.get('/api/economy')).json<{ packs: unknown[] }>();
    expect(economy.packs.length).toBeGreaterThan(0); // starter satchel

    const again = new Client(t.app);
    await viaDiscord(again, code);
    expect((await me(again)).id).toBe(user.id);
  });

  it('tags the username when the handle is taken', async () => {
    await passwordUser('owner@example.com', 'takenfox', false);
    const c = new Client(t.app);
    await viaDiscord(c, discordUser({ username: 'takenfox' }));
    expect((await me(c)).username).toMatch(/^takenfox_\d{4}$/);
  });

  it('sends a verification mail when Discord has not verified the email', async () => {
    const c = new Client(t.app);
    await viaDiscord(c, discordUser({ email: 'unverified@discord.test', emailVerified: false }));
    expect((await me(c)).emailVerified).toBe(false);
    expect(t.mail.findLast((m) => m.to === 'unverified@discord.test')?.text).toContain(
      'http://app.test/verify-email?token=',
    );
  });

  it('links to an existing account only when both emails are verified', async () => {
    const owner = await passwordUser('both@example.com', 'both_ok', true);
    const c = new Client(t.app);
    await viaDiscord(c, discordUser({ email: 'BOTH@example.com' }));
    expect((await me(c)).id).toBe((await me(owner)).id);
    expect((await linked(owner)).discord).not.toBeNull();

    await passwordUser('notyet@example.com', 'not_yet', false);
    const res = await viaDiscord(new Client(t.app), discordUser({ email: 'notyet@example.com' }));
    expect(res.headers.location).toBe('http://app.test/login?oauth=emailExists');

    await passwordUser('claim@example.com', 'claimed', true);
    const claim = discordUser({ email: 'claim@example.com', emailVerified: false });
    expect((await viaDiscord(new Client(t.app), claim)).headers.location).toBe(
      'http://app.test/login?oauth=emailExists',
    );
  });

  it('needs an email from Discord', async () => {
    const res = await viaDiscord(new Client(t.app), discordUser({ email: null }));
    expect(res.headers.location).toBe('http://app.test/login?oauth=noEmail');
  });

  it('rejects a missing or wrong state, and reports a denied consent', async () => {
    const code = discordUser();
    const noCookie = await new Client(t.app).get(`/api/auth/discord/callback?code=${code}&state=x`);
    expect(noCookie.headers.location).toBe('http://app.test/login?oauth=failed');

    const c = new Client(t.app);
    await c.get('/api/auth/discord/start');
    const wrong = await c.get(`/api/auth/discord/callback?code=${code}&state=${'a'.repeat(43)}`);
    expect(wrong.headers.location).toBe('http://app.test/login?oauth=failed');
    expect((await c.get('/api/auth/me')).statusCode).toBe(401);

    const d = new Client(t.app);
    const start = await d.get('/api/auth/discord/start');
    const state = new URL(start.headers.location ?? '').searchParams.get('state') ?? '';
    const denied = await d.get(`/api/auth/discord/callback?error=access_denied&state=${state}`);
    expect(denied.headers.location).toBe('http://app.test/login?oauth=denied');
    // The state is single-use: the cookie is gone after one callback.
    const replay = await d.get(`/api/auth/discord/callback?code=${code}&state=${state}`);
    expect(replay.headers.location).toBe('http://app.test/login?oauth=failed');
  });

  it('fails cleanly when the code exchange fails', async () => {
    const res = await viaDiscord(new Client(t.app), 'no-such-code');
    expect(res.headers.location).toBe('http://app.test/login?oauth=failed');
  });
});

describe('linking from Settings', () => {
  it('links, refuses a Discord used elsewhere, and unlinks', async () => {
    const c = await passwordUser('linker@example.com', 'linker', false);
    await c.csrf();
    const code = discordUser({ email: 'other@discord.test' });
    const res = await viaDiscord(c, code, 'link');
    expect(res.headers.location).toBe('http://app.test/settings?discord=linked');
    const l = await linked(c);
    expect(l.hasPassword).toBe(true);
    expect(l.discord?.username).toMatch(/^Fox \d+$/);

    const other = await passwordUser('other2@example.com', 'other_two', false);
    const taken = await viaDiscord(other, code, 'link');
    expect(taken.headers.location).toBe('http://app.test/settings?discord=taken');

    expect((await c.post('/api/auth/discord/unlink')).statusCode).toBe(204);
    expect((await linked(c)).discord).toBeNull();
    expect((await viaDiscord(other, code, 'link')).headers.location).toBe(
      'http://app.test/settings?discord=linked',
    );
  });

  it('needs a login to link', async () => {
    const res = await new Client(t.app).get('/api/auth/discord/start?mode=link');
    expect(res.headers.location).toBe('http://app.test/login?oauth=loginRequired');
  });

  it('keeps Discord when it is the only way to log in', async () => {
    const c = new Client(t.app);
    await viaDiscord(c, discordUser());
    await c.csrf();
    const res = await c.post('/api/auth/discord/unlink');
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ error: { code: 'lastLoginMethod' } });
  });
});
