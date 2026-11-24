import { expect, test, type Page } from '@playwright/test';
import { apiPost, loggedIn, settle } from './helpers.js';

const OUT = '../../docs/opening/mythic';

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

/** Drags along the Mythic seam (pack-local row 17) from column `from` to `to`. */
async function dragSeam(page: Page, from: number, to: number) {
  const a = await packPoint(page, from, 17);
  const b = await packPoint(page, to, 17);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.mouse.up();
}

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `${OUT}/${name}.png`, animations: 'disabled' });

const pending = async (page: Page) =>
  ((await (await page.request.get('/api/economy')).json()) as { pendingOpeningId: string | null })
    .pendingOpeningId;

test.describe('the Mythic pack', () => {
  test.use({ viewport: { width: 1280, height: 860 } });

  test('bought with gems, opened in stages (lock → runes → burst), revealed', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await loggedIn(page);
    await page.goto('/packs');
    const mythic = page.getByRole('listitem', { name: 'Mythic pack' });
    const buy = mythic.getByRole('button', { name: 'Buy a Mythic pack for 300 gems' });
    // On the shelf with its gem price; no gems yet.
    await expect(mythic.getByText('300')).toBeVisible();
    await expect(buy).toBeDisabled();
    await expect(page.getByRole('meter', { name: 'Legendary guarantee, Mythic packs' })).toBeVisible();

    await apiPost(page, '/api/dev/grant', { gems: 300 });
    await page.reload();
    await expect(buy).toBeEnabled();
    await buy.click();
    await expect(mythic.getByLabel('1 owned')).toBeVisible();
    await expect(buy).toBeDisabled();
    await settle(page);
    await shot(page, 'shelf');

    // Stage 1: the padlock rattles as the seam starts to tear.
    await mythic.getByRole('button', { name: 'Open' }).click();
    const scene = page.getByRole('dialog', { name: 'Opening a Mythic pack' });
    await expect(scene).toHaveAttribute('data-phase', 'tear');
    await packPoint(page, 0, 0);
    await settle(page);
    await shot(page, 'tear-1-locked');
    await dragSeam(page, 13, 22);
    await shot(page, 'tear-2-rattle');
    // Stage 2: the lock springs open and drops; the sigil and runes light up.
    await dragSeam(page, 22, 38);
    await page.waitForTimeout(600);
    await shot(page, 'tear-3-runes');
    // Stage 3: the burst.
    await dragSeam(page, 38, 52);
    await page.waitForTimeout(300);
    await shot(page, 'tear-4-burst');

    // The reveal (the featured slot rolls Epic or better on the server).
    await expect(scene).toHaveAttribute('data-phase', 'reveal');
    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(scene).toHaveAttribute('data-phase', 'summary');
    await expect(page.locator('.summary__card')).toHaveCount(5);
    await expect(page.locator('.summary__card[data-featured="true"]')).toHaveCount(1);
    await settle(page);
    await shot(page, 'summary');
    await expect.poll(() => pending(page)).toBeNull();
    await page.getByRole('button', { name: 'Back to the shelf' }).click();
    await expect(mythic.getByRole('button', { name: 'Open' })).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test('the click fallback plays all three stages', async ({ page }) => {
    await page.goto('/debug/moments?scene=tear&pack=mythic&rarity=epic&fx=full');
    await expect(page.locator('.tear')).toHaveAttribute('data-ready', 'true');
    await page.getByRole('button', { name: 'Tear it open' }).click();
    // Slow enough to see the lock go and the runes light before the burst.
    await page.waitForTimeout(700);
    await expect(page.locator('.tear')).not.toHaveAttribute('data-progress', '0');
    await shot(page, 'click-fallback');
  });
});
