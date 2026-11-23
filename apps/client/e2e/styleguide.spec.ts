import { expect, test } from '@playwright/test';
import { OUT, loggedIn, settle } from './helpers.js';

test('style guide renders the approved style-tile parts', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/styleguide');
  await settle(page);
  await expect(page.getByRole('heading', { name: 'Style guide' })).toBeVisible();
  await expect(page.locator('figure.card[data-rarity]')).toHaveCount(8);
  expect(await page.evaluate(() => document.fonts.check('32px "Pixel Packs Hollow"'))).toBe(true);
  // Every pixel image is drawn unsmoothed.
  const smoothed = await page.$$eval(
    'img',
    (imgs) => imgs.filter((i) => getComputedStyle(i).imageRendering !== 'pixelated').length,
  );
  expect(smoothed).toBe(0);
  await page.screenshot({ path: `${OUT}/styleguide.png`, fullPage: true });
});

test('app shell: navigation, routing and the phone layout', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loggedIn(page);
  await page.goto('/');
  await settle(page);
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  await page.screenshot({ path: `${OUT}/shell-home.png` });

  await nav.getByRole('link', { name: 'Binder' }).click();
  await expect(page).toHaveURL(/\/binder$/);
  await expect(page.getByRole('heading', { name: 'Nothing tucked in yet' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Nothing tucked in yet' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await settle(page);
  await page.screenshot({ path: `${OUT}/shell-phone.png` });
});

test('settings persist and switch motion off', async ({ page }) => {
  await loggedIn(page);
  await page.goto('/settings');
  await page.getByLabel('Reduced').check();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await page.reload();
  await expect(page.getByLabel('Reduced')).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
});
