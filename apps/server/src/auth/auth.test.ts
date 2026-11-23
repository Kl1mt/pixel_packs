import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { UserResponseSchema } from '@pixel-packs/shared';
import { sessions, users, wallets } from '../db/schema.js';
import { Client, createTestApp, tokenFromMail, type TestApp } from '../testing/harness.js';

const PASSWORD = 'correct horse battery';
let counter = 0;
const fresh = () => {
  counter += 1;
  return { email: `pip${counter}@example.com`, username: `pip_${counter}`, password: PASSWORD };
};

let t: TestApp;
let clock = new Date();
beforeAll(async () => {
  t = await createTestApp({ now: () => clock });
});
afterAll(() => t.close());
beforeEach(() => {
  clock = new Date();
});

async function registered() {
  const c = new Client(t.app);
  await c.csrf();
  const input = fresh();
  const res = await c.post('/api/auth/register', input);
  expect(res.statusCode).toBe(201);
  return { c, input, user: UserResponseSchema.parse(res.json()).user };
}

describe('CSRF', () => {
  it('rejects mutations without a matching token', async () => {
    const c = new Client(t.app);
    const none = await c.request({
      method: 'POST',
      url: '/api/auth/login',
      payload: fresh(),
      csrf: false,
    });
    expect(none.statusCode).toBe(403);
    expect(none.json()).toMatchObject({ error: { code: 'csrf' } });

    await c.csrf();
    const wrong = await c.request({
      method: 'POST',
      url: '/api/auth/login',
      payload: fresh(),
      headers: { 'x-csrf-token': 'x'.repeat(43) },
    });
    expect(wrong.statusCode).toBe(403);
  });

  it('keeps the same token while the cookie exists', async () => {
    const c = new Client(t.app);
    expect(await c.csrf()).toBe(await c.csrf());
  });
});

describe('register', () => {
  it('creates the user, a wallet and a session, and mails a verification link', async () => {
    const before = t.mail.length;
    const { c, input, user } = await registered();
    expect(user).toMatchObject({
      email: input.email,
      username: input.username,
      emailVerified: false,
    });

    const cookie = (await t.app.inject({ method: 'GET', url: '/api/auth/csrf' })).cookies;
    expect(cookie[0]).toMatchObject({ name: 'pp_csrf', sameSite: 'Lax' });

    const me = await c.get('/api/auth/me');
    expect(UserResponseSchema.parse(me.json()).user.id).toBe(user.id);

    const [wallet] = await t.db.db.select().from(wallets).where(eq(wallets.userId, user.id));
    expect(wallet).toMatchObject({ gold: 0, dust: 0, gems: 0 });
    const [row] = await t.db.db.select().from(users).where(eq(users.id, user.id));
    expect(row?.passwordHash).toMatch(/^\$argon2id\$/);

    expect(t.mail.length).toBe(before + 1);
    expect(t.mail.at(-1)?.to).toBe(input.email);
    expect(t.mail.at(-1)?.text).toContain('http://app.test/verify-email?token=');
  });

  it('sets an httpOnly, SameSite=Lax session cookie', async () => {
    const c = new Client(t.app);
    await c.csrf();
    const res = await c.post('/api/auth/register', fresh());
    const session = res.cookies.find((x) => x.name === 'pp_session');
    expect(session).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
  });

  it('rejects taken emails and usernames regardless of case', async () => {
    const { input } = await registered();
    const c = new Client(t.app);
    await c.csrf();
    const email = await c.post('/api/auth/register', {
      ...fresh(),
      email: input.email.toUpperCase(),
    });
    expect(email.statusCode).toBe(409);
    expect(email.json()).toMatchObject({ error: { code: 'emailTaken' } });
    const name = await c.post('/api/auth/register', {
      ...fresh(),
      username: input.username.toUpperCase(),
    });
    expect(name.json()).toMatchObject({ error: { code: 'usernameTaken' } });
  });

  it('validates input', async () => {
    const c = new Client(t.app);
    await c.csrf();
    for (const bad of [
      { ...fresh(), password: 'short' },
      { ...fresh(), username: 'admin' },
      { email: 'x' },
    ]) {
      const res = await c.post('/api/auth/register', bad);
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ error: { code: 'badRequest' } });
    }
  });
});

describe('login, me and logout', () => {
  it('logs in with the right password only, with the same error for unknown emails', async () => {
    const { input } = await registered();
    const c = new Client(t.app);
    await c.csrf();
    const wrong = await c.post('/api/auth/login', {
      email: input.email,
      password: 'wrong password!',
    });
    const unknown = await c.post('/api/auth/login', {
      email: 'nobody@example.com',
      password: PASSWORD,
    });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.json()).toEqual(wrong.json());
    expect((await c.get('/api/auth/me')).statusCode).toBe(401);

    const ok = await c.post('/api/auth/login', {
      email: input.email.toUpperCase(),
      password: PASSWORD,
    });
    expect(ok.statusCode).toBe(200);
    expect((await c.get('/api/auth/me')).statusCode).toBe(200);
  });

  it('logout deletes the session', async () => {
    const { c, user } = await registered();
    const res = await c.post('/api/auth/logout');
    expect(res.statusCode).toBe(204);
    expect((await c.get('/api/auth/me')).statusCode).toBe(401);
    expect(await t.db.db.select().from(sessions).where(eq(sessions.userId, user.id))).toHaveLength(
      0,
    );
  });

  it('sessions expire after 30 days', async () => {
    const { c } = await registered();
    const session = c.cookies.get('pp_session');
    clock = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
    const res = await t.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { pp_session: session ?? '' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('email verification', () => {
  it('verifies once with the mailed token', async () => {
    const { c } = await registered();
    const token = tokenFromMail(t.mail.at(-1));
    expect((await c.post('/api/auth/verify-email', { token })).statusCode).toBe(204);
    expect(UserResponseSchema.parse((await c.get('/api/auth/me')).json()).user.emailVerified).toBe(
      true,
    );
    const again = await c.post('/api/auth/verify-email', { token });
    expect(again.json()).toMatchObject({ error: { code: 'invalidToken' } });
  });

  it('rejects expired tokens and can resend', async () => {
    const { c } = await registered();
    const token = tokenFromMail(t.mail.at(-1));
    clock = new Date(Date.now() + 25 * 60 * 60 * 1000);
    expect((await c.post('/api/auth/verify-email', { token })).statusCode).toBe(400);
    clock = new Date();
    expect((await c.post('/api/auth/resend-verification')).statusCode).toBe(204);
    const fresh = tokenFromMail(t.mail.at(-1));
    expect(fresh).not.toBe(token);
    expect((await c.post('/api/auth/verify-email', { token: fresh })).statusCode).toBe(204);
  });
});

describe('password reset', () => {
  it('does not reveal unknown emails', async () => {
    const c = new Client(t.app);
    await c.csrf();
    const before = t.mail.length;
    const res = await c.post('/api/auth/password-reset/request', { email: 'ghost@example.com' });
    expect(res.statusCode).toBe(202);
    expect(t.mail.length).toBe(before);
  });

  it('sets a new password, ends all sessions and voids the link', async () => {
    const { c: oldDevice, input } = await registered();
    const c = new Client(t.app);
    await c.csrf();
    expect(
      (await c.post('/api/auth/password-reset/request', { email: input.email })).statusCode,
    ).toBe(202);
    const token = tokenFromMail(t.mail.at(-1));
    expect(t.mail.at(-1)?.text).toContain('http://app.test/reset-password?token=');

    const newPassword = 'a brand new password';
    expect(
      (await c.post('/api/auth/password-reset/confirm', { token, password: newPassword }))
        .statusCode,
    ).toBe(204);
    expect((await oldDevice.get('/api/auth/me')).statusCode).toBe(401);
    expect(
      (await c.post('/api/auth/login', { email: input.email, password: PASSWORD })).statusCode,
    ).toBe(401);
    const login = await c.post('/api/auth/login', { email: input.email, password: newPassword });
    expect(UserResponseSchema.parse(login.json()).user.emailVerified).toBe(true);
    const reuse = await c.post('/api/auth/password-reset/confirm', {
      token,
      password: newPassword,
    });
    expect(reuse.statusCode).toBe(400);
  });

  it('reset links expire after an hour', async () => {
    const { c, input } = await registered();
    await c.post('/api/auth/password-reset/request', { email: input.email });
    const token = tokenFromMail(t.mail.at(-1));
    clock = new Date(Date.now() + 61 * 60 * 1000);
    const res = await c.post('/api/auth/password-reset/confirm', {
      token,
      password: 'another long password',
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('rate limits', () => {
  it('limits login attempts per IP', async () => {
    const limited = await createTestApp({ rateLimit: true });
    try {
      const c = new Client(limited.app);
      await c.csrf();
      const codes: number[] = [];
      for (let i = 0; i < 11; i += 1) {
        codes.push(
          (await c.post('/api/auth/login', { email: 'x@example.com', password: 'nope' }))
            .statusCode,
        );
      }
      expect(codes.slice(0, 10).every((s) => s === 401)).toBe(true);
      const last = await c.post('/api/auth/login', { email: 'x@example.com', password: 'nope' });
      expect(last.statusCode).toBe(429);
      expect(last.json()).toMatchObject({ error: { code: 'rateLimited' } });
    } finally {
      await limited.close();
    }
  });
});
