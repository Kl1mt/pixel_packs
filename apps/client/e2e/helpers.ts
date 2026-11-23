import { expect, type Page } from '@playwright/test';

export const OUT = '../../docs/styleguide';
export const PASSWORD = 'correct horse battery';

/** Waits until the pixel font and every image have loaded, so screenshots are stable. */
export async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images)
        .filter((img) => !img.complete)
        .map(
          (img) =>
            new Promise<void>((resolve) => {
              img.addEventListener(
                'load',
                () => {
                  resolve();
                },
                { once: true },
              );
            }),
        ),
    );
  });
}

let n = 0;
/** A fresh, unique player identity. */
export function newIdentity() {
  n += 1;
  // Hex only: the username blocklist reads digits as letters (5→s, 4→a…) and matches
  // substrings, so a base-36 tag could spell a blocked word; a–f plus those digits cannot.
  const tag = `${Date.now().toString(16)}${String(n)}`;
  return {
    email: `e2e${tag}@example.com`,
    username: `e2e_${tag}`.slice(0, 20),
    password: PASSWORD,
  };
}

/** Registers through the API (sharing the page's cookies), so a test starts logged in. */
export async function loggedIn(page: Page) {
  const who = newIdentity();
  const csrf = await page.request.get('/api/auth/csrf');
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };
  const res = await page.request.post('/api/auth/register', {
    data: who,
    headers: { 'x-csrf-token': csrfToken },
  });
  expect(res.status()).toBe(201);
  return who;
}

/** POSTs JSON with the CSRF token, as the page's logged-in player. */
export async function apiPost(page: Page, path: string, data?: object) {
  const csrf = await page.request.get('/api/auth/csrf');
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };
  const res = await page.request.post(path, {
    ...(data ? { data } : {}),
    headers: { 'x-csrf-token': csrfToken },
  });
  expect(res.ok()).toBe(true);
  return res;
}

/** Skips the whole onboarding (T16), as "Skip the welcome" does: Home opens straight away. */
export async function skipOnboarding(page: Page) {
  await apiPost(page, '/api/onboarding/advance', { stage: 'done' });
}
