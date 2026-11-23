import { expect, test } from '@playwright/test';
import { OUT, PASSWORD, newIdentity, settle } from './helpers.js';

test('a new player registers, logs out and logs back in', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/binder');
  // Guests land on the login screen and come back afterwards.
  await expect(page).toHaveURL(/\/login\?next=%2Fbinder$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  // No Discord credentials on this server, so the button is not there at all.
  await expect(page.getByText('Log in with Discord')).toHaveCount(0);
  await settle(page);
  await page.screenshot({ path: `${OUT}/auth-login.png` });

  await page.getByRole('link', { name: 'Make an account' }).click();
  await expect(page.getByRole('heading', { name: 'Make an account' })).toBeVisible();
  await settle(page);
  await page.screenshot({ path: `${OUT}/auth-register.png` });

  const who = newIdentity();
  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Username').fill(who.username);
  await page.getByLabel('Password').fill(who.password);
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page).toHaveURL(/\/binder$/);
  await expect(page.getByRole('heading', { name: 'Nothing tucked in yet' })).toBeVisible();
  await expect(page.getByText(`We sent a letter to ${who.email}`)).toBeVisible();
  // The starter satchel's wallet replaces the unknown "–" badges.
  await expect(page.getByLabel('Wallet')).not.toContainText('–');

  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page.getByText(`Logged in as ${who.username}`)).toBeVisible();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel('Email').fill(who.email);
  await page.getByLabel('Password').fill('not the password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('alert')).toHaveText('Email or password is wrong.');

  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  // Onboarding (T16) isn't finished yet: Home sends the player back to the courier.
  const welcome = page.getByRole('heading', { name: 'Welcome to the Wandering Post' });
  await expect(welcome).toBeVisible();
  await page.reload();
  await expect(welcome).toBeVisible();
});

test('register explains what is wrong, field by field', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Email').fill('not-an-email');
  await page.getByLabel('Username').fill('a!');
  await page.getByLabel('Password').fill('short');
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Use 3–20 letters, digits or underscores.')).toBeVisible();
  await expect(page.getByText('Use at least 10 characters.')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await settle(page);
  await page.screenshot({ path: `${OUT}/auth-register-phone.png`, fullPage: true });

  // A taken name is reported on its field by the server.
  const first = newIdentity();
  const csrf = (await (await page.request.get('/api/auth/csrf')).json()) as { csrfToken: string };
  await page.request.post('/api/auth/register', {
    data: first,
    headers: { 'x-csrf-token': csrf.csrfToken },
  });
  await page.context().clearCookies();
  await page.goto('/register');
  await page.getByLabel('Email').fill(newIdentity().email);
  await page.getByLabel('Username').fill(first.username.toUpperCase());
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page.getByText('That username is already taken.')).toBeVisible();
});

test('email links: a broken reset link and a broken verify link', async ({ page }) => {
  await page.goto('/reset-password?token=nope');
  await expect(page.getByRole('heading', { name: 'This link is worn out' })).toBeVisible();
  await page.goto(`/verify-email?token=${'a'.repeat(43)}`);
  await expect(page.getByText('This link is invalid or has expired.')).toBeVisible();
});
