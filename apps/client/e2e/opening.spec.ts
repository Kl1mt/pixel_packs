import { expect, test, type Page } from '@playwright/test';
import { completeOnboarding, loggedIn, settle } from './helpers.js';

const OUT = '../../docs/opening';

/** Screen position of a pack-local art pixel on the tear canvas (the pack is centred). */
async function packPoint(page: Page, x: number, y: number) {
  const canvas = page.getByTestId('tear-canvas');
  await expect(page.locator('.tear')).toHaveAttribute('data-ready', 'true');
  const box = await canvas.boundingBox();
  const size = await canvas.evaluate((c: HTMLCanvasElement) => ({ w: c.width, h: c.height }));
  if (!box) throw new Error('no canvas');
  const scale = box.width / size.w;
  const ox = Math.floor((size.w - 64) / 2);
  const oy = Math.floor((size.h - 64) / 2);
  return { x: box.x + (ox + x + 0.5) * scale, y: box.y + (oy + y + 0.5) * scale };
}

/** Drags along the seam (pack-local row 19) from column `from` to `to`. */
async function dragSeam(page: Page, from: number, to: number) {
  const a = await packPoint(page, from, 19);
  const b = await packPoint(page, to, 19);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.mouse.up();
}

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `${OUT}/${name}.png`, animations: 'disabled' });

async function api(page: Page, path: string, data: object) {
  const csrf = await page.request.get('/api/auth/csrf');
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };
  const res = await page.request.post(path, { data, headers: { 'x-csrf-token': csrfToken } });
  expect(res.ok()).toBe(true);
}

const pending = async (page: Page) =>
  ((await (await page.request.get('/api/economy')).json()) as { pendingOpeningId: string | null })
    .pendingOpeningId;

test.describe('pack opening', () => {
  test.use({ viewport: { width: 1280, height: 860 } });

  test('shelf → tear → reveal → results, then resume an unfinished reveal', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await loggedIn(page);
    await completeOnboarding(page);
    await page.goto('/packs');
    const moss = page.getByRole('listitem', { name: 'Mossgrove pack' });
    await expect(moss.getByLabel('1 owned')).toBeVisible();
    await expect(
      page.getByRole('meter', { name: 'Legendary guarantee, realm packs' }),
    ).toBeVisible();
    await settle(page);
    await shot(page, 'shelf');

    // The odds "?".
    await moss.getByRole('button', { name: 'Mossgrove pack odds' }).click();
    const odds = page.getByRole('dialog', { name: 'Mossgrove pack odds' });
    await expect(odds.getByRole('row', { name: /Legendary 0\.3 % 3\.2 %/ })).toBeVisible();
    await shot(page, 'odds');
    await odds.getByRole('button', { name: 'Close' }).click();

    // Open: drag halfway along the seam, then finish the tear.
    await moss.getByRole('button', { name: 'Open' }).click();
    const scene = page.getByRole('dialog', { name: 'Opening a Mossgrove pack' });
    await expect(scene).toHaveAttribute('data-phase', 'tear');
    await packPoint(page, 0, 0);
    await settle(page);
    await shot(page, 'tear');
    await dragSeam(page, 15, 30);
    await expect(page.locator('.tear')).not.toHaveAttribute('data-progress', '0');
    await shot(page, 'tear-half');
    await dragSeam(page, 30, 47);
    await page.waitForTimeout(250);
    await shot(page, 'tear-burst');

    // The card stack: flip in reveal order, the featured card last.
    await expect(scene).toHaveAttribute('data-phase', 'reveal');
    await settle(page);
    await shot(page, 'reveal-stack');
    const stack = page.getByTestId('card-stack');
    await stack.click();
    await stack.click();
    await expect(page.locator('.reveal')).toHaveAttribute('data-flipped', '2');
    await page.waitForTimeout(400);
    await settle(page);
    await shot(page, 'reveal-flip');
    await page.getByRole('button', { name: 'Reveal all' }).click();
    await expect(page.locator('.reveal')).toHaveAttribute('data-flipped', '5');
    await page.waitForTimeout(400);
    await settle(page);
    await shot(page, 'reveal-featured');

    // The spotlight card leans towards the pointer (≤ 8°, T22) and rests flat again. It is
    // held flat while a reveal moment plays (a random pull can have one), and "See results"
    // unlocks once that moment is over, so wait for it before moving the pointer.
    await expect(page.getByRole('button', { name: 'See results' })).toBeEnabled({
      timeout: 15_000,
    });
    const spot = page.locator('.reveal__card .tilt');
    await expect(spot).not.toHaveAttribute('data-tilting', 'true');
    const box = await spot.boundingBox();
    if (box) await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.1);
    await expect(spot).toHaveAttribute('data-tilting', 'true');
    const tiltY = await spot
      .locator('.tilt__card')
      .evaluate((el) => parseFloat(el.style.getPropertyValue('--tilt-y')));
    expect(Math.abs(tiltY)).toBeGreaterThan(0);
    expect(Math.abs(tiltY)).toBeLessThanOrEqual(8);
    await shot(page, 'reveal-tilt');
    await page.mouse.move(2, 2);
    await expect(spot).not.toHaveAttribute('data-tilting', 'true');

    // Results: the reveal is reported finished.
    await page.getByRole('button', { name: 'See results' }).click();
    await expect(scene).toHaveAttribute('data-phase', 'summary');
    await expect(page.getByText(/new cards? ·/)).toBeVisible();
    await expect(page.locator('.summary__card')).toHaveCount(5);
    await settle(page);
    await shot(page, 'summary');
    // The results tilt too, and scroll without a visible scroll bar (T22).
    const result = page.locator('.summary__card .tilt').first();
    await result.hover({ position: { x: 4, y: 4 } });
    await expect(result).toHaveAttribute('data-tilting', 'true');
    await page.mouse.move(2, 2);
    expect(await scene.evaluate((el) => getComputedStyle(el).scrollbarWidth)).toBe('none');
    await page.setViewportSize({ width: 1280, height: 420 });
    await scene.focus();
    const scrolled = await scene.evaluate((el) => el.scrollHeight > el.clientHeight);
    expect(scrolled).toBe(true);
    await page.keyboard.press('End');
    await expect.poll(() => scene.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await page.setViewportSize({ width: 1280, height: 860 });
    await expect.poll(() => pending(page)).toBeNull();
    await page.getByRole('button', { name: 'Back to the shelf' }).click();
    await expect(scene).toBeHidden();
    await expect(moss.getByRole('button', { name: 'Open' })).toBeDisabled();

    // Starhollow (plain theme until T13): the click fallback, then leave mid-reveal.
    const star = page.getByRole('listitem', { name: 'Starhollow pack' });
    await star.getByRole('button', { name: 'Open' }).click();
    await page.getByRole('button', { name: 'Tear it open' }).click();
    const starScene = page.getByRole('dialog', { name: 'Opening a Starhollow pack' });
    await expect(starScene).toHaveAttribute('data-phase', 'reveal');
    await page.getByTestId('card-stack').click();
    expect(await pending(page)).not.toBeNull();
    await page.reload();
    await settle(page);
    await shot(page, 'resume');
    await page.getByRole('button', { name: 'Resume reveal' }).click();
    await expect(starScene).toHaveAttribute('data-phase', 'reveal');
    await expect(page.locator('.reveal')).toHaveAttribute('data-flipped', '0');
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    await expect(starScene).toHaveAttribute('data-phase', 'summary');
    await expect.poll(() => pending(page)).toBeNull();
    await page.getByRole('button', { name: 'Back to the shelf' }).click();
    await expect(page.getByRole('button', { name: 'Resume reveal' })).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('buying, the free pack and dev forcing from /debug', async ({ page }) => {
    await loggedIn(page);
    await completeOnboarding(page);
    await page.goto('/packs');
    const moss = page.getByRole('listitem', { name: 'Mossgrove pack' });
    // No gold yet; the free pack goes to the inventory.
    await expect(moss.getByRole('button', { name: /Buy a Mossgrove pack/ })).toBeDisabled();
    await page.getByRole('button', { name: 'Take Mossgrove' }).click();
    await expect(moss.getByLabel('2 owned')).toBeVisible();
    await expect(page.getByText(/Next free pack at/)).toBeVisible();

    // Dev forcing: grant gold and packs, force an Epic Void featured card.
    await page.goto('/debug');
    const forcing = page.getByRole('region', { name: 'Dev forcing' });
    await forcing.getByRole('button', { name: '+1000 gold' }).click();
    await expect(forcing.getByRole('status')).toHaveText('Granted 1000 gold.');
    await forcing.getByLabel('Featured rarity').selectOption('epic');
    await forcing.getByLabel('Featured variant').selectOption('void');
    await forcing.getByLabel('Packs').selectOption('3');
    await forcing.getByRole('button', { name: 'Force' }).click();
    await expect(forcing.getByRole('status')).toContainText('feature epic void');
    await forcing.screenshot({ path: `${OUT}/debug-forcing.png` });

    // The first two realm packs are the scripted onboarding packs: open them via the API.
    for (const packTypeId of ['realm:mossgrove', 'realm:starhollow']) {
      await api(page, '/api/packs/open', { packTypeId, idempotencyKey: crypto.randomUUID() });
    }
    await page.goto('/packs');
    await page.getByRole('button', { name: 'Resume reveal' }).click();
    await page.getByRole('button', { name: 'Skip', exact: true }).click();
    await page.getByRole('button', { name: 'Back to the shelf' }).click();
    await expect(page.locator('.shell__wallet')).toContainText('1000');
    await moss.getByRole('button', { name: /Buy a Mossgrove pack/ }).click();
    await expect(page.locator('.shell__wallet')).toContainText('900');
    await expect(moss.getByLabel('2 owned')).toBeVisible();

    await moss.getByRole('button', { name: 'Open' }).click();
    await page.getByRole('button', { name: 'Tear it open' }).click();
    const stack = page.getByTestId('card-stack');
    for (let i = 0; i < 4; i++) await stack.click();
    await expect(stack).toHaveAttribute('data-featured', 'true');
    await expect(stack).toHaveAttribute('data-glow', 'epic');
    await settle(page);
    await shot(page, 'reveal-epic-back');
    await stack.click();
    const featured = page.locator('.reveal__card');
    await expect(featured).toHaveAttribute('data-rarity', 'epic');
    await expect(featured.locator('.card-stage')).toHaveAttribute('data-ready', 'true');
    await shot(page, 'reveal-void');
    await page.getByRole('button', { name: 'See results' }).click();
    await expect(page.getByRole('button', { name: 'Open another' })).toBeVisible();
  });
});
