import { expect, test, type Page } from '@playwright/test';
import { loggedIn, newIdentity, settle, completeOnboarding } from './helpers.js';

const OUT = '../../docs/onboarding';
const shot = (page: Page, name: string) =>
  page.screenshot({ path: `${OUT}/${name}.png`, animations: 'disabled' });

/** One scripted pack: the click-fallback tear, "Reveal all", the results, then leave. */
async function openScripted(page: Page, realm: string, leave: string) {
  await page.getByRole('button', { name: `Open the ${realm} pack` }).click();
  const scene = page.getByRole('dialog', { name: `Opening a ${realm} pack` });
  await page.getByRole('button', { name: 'Tear it open' }).click();
  await expect(scene).toHaveAttribute('data-phase', 'reveal');
  await page.getByRole('button', { name: 'Reveal all' }).click();
  await expect(page.locator('.reveal')).toHaveAttribute('data-flipped', '5');
  await page.getByRole('button', { name: 'See results' }).click();
  await expect(scene).toHaveAttribute('data-phase', 'summary');
  await expect(page.locator('.summary__card')).toHaveCount(5);
  await page.getByRole('button', { name: leave }).click();
  await expect(scene).toBeHidden();
}

test.describe('onboarding', () => {
  test.use({ viewport: { width: 1280, height: 860 } });

  test('a new player goes from registering to Home in under 90 s', async ({ page }) => {
    await page.goto('/register');
    const started = Date.now();
    const who = newIdentity();
    await page.getByLabel('Email').fill(who.email);
    await page.getByLabel('Username').fill(who.username);
    await page.getByLabel('Password').fill(who.password);
    await page.getByRole('button', { name: 'Sign up' }).click();

    // 1. The moth courier: three lines.
    await expect(page).toHaveURL(/\/welcome$/);
    // From here on (the guest's 401 from /api/auth/me is behind us) nothing may fail.
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    const line = page.getByTestId('courier-line');
    await expect(line).toContainText('Special delivery');
    await settle(page);
    await shot(page, 'courier');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(line).toContainText('two sealed packs');
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(line).toContainText('binder');
    await page.getByRole('button', { name: 'Take the satchel' }).click();

    // 2–3. The scripted packs: an Epic featured card, then a Foil.
    await expect(page.getByRole('heading', { name: 'Your first pack' })).toBeVisible();
    await settle(page);
    await shot(page, 'pack-1');
    await openScripted(page, 'Mossgrove', 'On to the next pack');
    await expect(page.getByRole('heading', { name: 'One more' })).toBeVisible();
    await openScripted(page, 'Starhollow', 'Off to the binder');

    // Oldest first: the Epic featured pack, then the Foil one.
    type Opened = {
      scripted: boolean;
      cards: { featured: boolean; rarity: string; variant: string }[];
    };
    const { openings } = (await (await page.request.get('/api/packs/history')).json()) as {
      openings: Opened[];
    };
    const featured = openings.reverse().map((o) => o.scripted && o.cards.find((c) => c.featured));
    expect(featured).toMatchObject([{ rarity: 'epic' }, { variant: 'foil' }]);

    // 4. The binder tour (2 tooltips), then the starter cards.
    await expect(page).toHaveURL(/\/binder\?tour=1$/);
    const tour = page.getByRole('dialog', { name: 'Binder tour' });
    await expect(tour).toContainText('One book, every realm');
    await expect(page.locator('.binder__realms.tour-target')).toBeVisible();
    await settle(page);
    await shot(page, 'tour-1');
    await tour.getByRole('button', { name: 'Next' }).click();
    await expect(tour).toContainText('A pocket for every card');
    await expect(page.locator('.pocket--owned.tour-target')).toHaveCount(1);
    await shot(page, 'tour-2');
    await tour.getByRole('button', { name: 'Got it' }).click();

    await expect(page.getByRole('heading', { name: 'Five friends for the road' })).toBeVisible();
    await expect(page.locator('.starter__card')).toHaveCount(5);
    await page.waitForTimeout(900);
    await settle(page);
    await shot(page, 'starter-cards');
    await page.getByRole('button', { name: 'Take them home' }).click();

    // 5. Home, with the free-pack timer pointed out.
    await expect(page).toHaveURL(/\/\?welcome=1$/);
    await expect(page.locator('.home-timer--highlight')).toBeVisible();
    const seconds = (Date.now() - started) / 1000;
    expect(seconds).toBeLessThan(90);
    await settle(page);
    await shot(page, 'home-welcome');

    // The cards landed: 10 pulled + 5 account-bound starters; Home stays Home on reload.
    const cards = (await (await page.request.get('/api/cards')).json()) as {
      copies: { source: string; accountBound: boolean }[];
    };
    expect(cards.copies).toHaveLength(15);
    expect(cards.copies.filter((c) => c.source === 'starter' && c.accountBound)).toHaveLength(5);
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    expect(errors).toEqual([]);
    console.log(`onboarding took ${seconds.toFixed(1)} s`);
  });

  test('nothing can be skipped, and a reload resumes the current step (T22)', async ({ page }) => {
    await loggedIn(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/welcome$/);
    const skips = page.getByRole('button', { name: /skip|later/i });
    await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
    await expect(skips).toHaveCount(0);
    // The game pages send an unfinished player back to the welcome flow.
    for (const path of ['/packs', '/binder', '/binder/history']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/welcome$/);
    }
    // The server refuses to jump ahead too.
    const csrf = (await (await page.request.get('/api/auth/csrf')).json()) as { csrfToken: string };
    const jump = await page.request.post('/api/onboarding/advance', {
      data: { stage: 'done' },
      headers: { 'x-csrf-token': csrf.csrfToken },
    });
    expect(jump.status()).toBe(409);

    for (let i = 0; i < 2; i += 1) await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Take the satchel' }).click();
    await expect(page.getByRole('heading', { name: 'Your first pack' })).toBeVisible();
    await expect(skips).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Your first pack' })).toBeVisible();
    await openScripted(page, 'Mossgrove', 'On to the next pack');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'One more' })).toBeVisible();
    await expect(skips).toHaveCount(0);
  });
});

test.describe('home', () => {
  test.use({ viewport: { width: 1280, height: 860 } });

  test('free pack, daily calendar and the satchel counter', async ({ page }) => {
    await loggedIn(page);
    await completeOnboarding(page);
    await page.goto('/');
    const satchel = page.getByRole('region', { name: 'Your packs' });
    await expect(satchel).toContainText('2 packs are waiting');
    await settle(page);
    await shot(page, 'home');

    // A brand-new account has one free pack ready.
    const free = page.getByRole('region', { name: 'Free pack' });
    await expect(free.getByTestId('free-pack-clock')).toHaveText('Ready');
    await free.getByRole('button', { name: 'Take Mossgrove' }).click();
    await expect(satchel).toContainText('3 packs are waiting');
    await expect(free.getByTestId('free-pack-clock')).toContainText(/h|min/);

    const daily = page.getByRole('region', { name: 'Daily calendar' });
    await expect(daily.getByLabel('Day 1, ready today')).toBeVisible();
    await daily.getByRole('button', { name: 'Open today’s letter' }).click();
    await expect(daily.getByLabel('Day 1, claimed')).toBeVisible();
    await expect(daily.getByLabel('Day 2, tomorrow')).toBeVisible();
    await expect(page.getByLabel('Wallet').getByLabel(/gold$/)).toBeVisible();
    await settle(page);
    await shot(page, 'home-claimed');

    await page.setViewportSize({ width: 390, height: 844 });
    await settle(page);
    await page.screenshot({ path: `${OUT}/home-phone.png`, fullPage: true });
    await satchel.getByRole('link', { name: 'Open packs' }).click();
    await expect(page).toHaveURL(/\/packs$/);
  });
});
