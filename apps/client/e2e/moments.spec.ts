import { expect, test, type Page } from '@playwright/test';
import { loggedIn, settle } from './helpers.js';

const OUT = '../../docs/opening/moments';

/** Opens the moment lab and waits until the moment's first frame is drawn. */
async function lab(page: Page, query: string) {
  await page.goto(`/debug/moments?${query}`);
  await settle(page);
  if (!query.includes('scene=tear'))
    await expect(page.getByTestId('moment')).not.toHaveAttribute('data-beat', 'none');
  // Two frames, so both canvases hold the frame.
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
}

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `${OUT}/${name}.png`, animations: 'disabled' });

/** Key frames (ms into the moment) of the full-effects sequences, for review (GDD §5, §6). */
const FRAMES: [string, string][] = [
  ['legendary-1-rays', 'rarity=legendary&at=800'],
  ['legendary-2-descend', 'rarity=legendary&at=1900'],
  ['legendary-3-crest', 'rarity=legendary&at=2650'],
  ['mythic-1-takeover', 'rarity=mythic&at=300'],
  ['mythic-2-freeze', 'rarity=mythic&at=900'],
  ['mythic-3-starhollow-eclipse', 'rarity=mythic&at=2900'],
  ['mythic-3-mossgrove-bloom', 'rarity=mythic&realm=mossgrove&at=2900'],
  ['mythic-4-shockwave', 'rarity=mythic&at=3500'],
  ['mythic-5-crest', 'rarity=mythic&realm=mossgrove&at=5000'],
  ['stinger-foil', 'rarity=rare&variant=foil&at=400'],
  ['stinger-prismatic', 'rarity=rare&variant=prismatic&at=500'],
  ['stinger-void', 'rarity=epic&variant=void&at=500'],
  ['stinger-glitch', 'rarity=epic&variant=glitch&at=400'],
];

test.describe('reveal moments', () => {
  test.use({ viewport: { width: 1280, height: 860 } });

  test('key frames of every moment, full and reduced', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    for (const [name, q] of FRAMES) {
      await lab(page, `${q}&fx=full`);
      await shot(page, name);
    }
    // Reduced effects: one still frame per beat, the same frame after a while.
    for (const [name, q] of [
      ['reduced-legendary', 'rarity=legendary&at=500'],
      ['reduced-mythic', 'rarity=mythic&at=300'],
      ['reduced-glitch', 'rarity=epic&variant=glitch&at=0'],
    ] as const) {
      await page.goto(`/debug/moments?${q.replace(/&at=\d+/, '')}&fx=reduced`);
      const moment = page.getByTestId('moment');
      await expect(moment).not.toHaveAttribute('data-beat', 'none');
      // The front layer follows the card's box, so let fonts and images settle first.
      await settle(page);
      await page.evaluate(
        () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
      );
      const frame = () =>
        page.evaluate(() => {
          const canvases = Array.from(
            document.querySelectorAll<HTMLCanvasElement>('.moment__layer'),
          );
          return {
            beat: document.querySelector('.moment')?.getAttribute('data-beat'),
            pixels: canvases.map((c) => c.toDataURL()).join(),
          };
        });
      const a = await frame();
      await page.waitForTimeout(120);
      const b = await frame();
      if (a.beat === b.beat) expect(b.pixels).toBe(a.pixels);
      await lab(page, `${q}&fx=reduced`);
      await shot(page, name);
    }
    expect(errors).toEqual([]);
  });

  test('the Starhollow tear: the moon clasp turns, stardust swirls', async ({ page }) => {
    await lab(page, 'scene=tear&realm=starhollow&rarity=legendary&fx=full');
    await expect(page.locator('.tear')).toHaveAttribute('data-ready', 'true');
    await shot(page, 'starhollow-tear');
    await page.getByRole('button', { name: 'Tear it open' }).click();
    await page.waitForTimeout(300);
    await shot(page, 'starhollow-tear-clasp');
    await page.waitForTimeout(350);
    await shot(page, 'starhollow-tear-burst');
  });

  test('a moment plays out live, and can be skipped', async ({ page }) => {
    await page.goto('/debug/moments?rarity=legendary&variant=foil&fx=full');
    const card = page.locator('.reveal__card');
    await expect(card).toHaveAttribute('data-arrival', 'waiting');
    await expect(card).toHaveAttribute('data-arrival', 'arriving', { timeout: 3000 });
    await expect(page.getByTestId('moment')).toHaveAttribute('data-beat', 'foil', {
      timeout: 5000,
    });
    await expect(page.getByTestId('moment')).toBeHidden({ timeout: 3000 });
    await expect(card).toHaveAttribute('data-arrival', 'landed');

    await page.getByRole('button', { name: 'Replay' }).click();
    await page.getByRole('button', { name: 'Skip animation' }).click();
    await expect(page.getByTestId('moment')).toBeHidden();
    await expect(page.getByRole('button', { name: 'See results' })).toBeEnabled();
  });

  test('a forced Mythic Glitch in a real pack holds "Reveal all" for its moment', async ({
    page,
  }) => {
    await loggedIn(page);
    await page.goto('/debug');
    const forcing = page.getByRole('region', { name: 'Dev forcing' });
    await forcing.getByRole('button', { name: '+5 starhollow' }).click();
    await expect(forcing.getByRole('status')).toHaveText('Granted 5 starhollow packs.');
    await forcing.getByLabel('Featured rarity').selectOption('mythic');
    await forcing.getByLabel('Featured variant').selectOption('glitch');
    await forcing.getByLabel('Packs').selectOption('3');
    await forcing.getByRole('button', { name: 'Force' }).click();
    await expect(forcing.getByRole('status')).toContainText('feature mythic glitch');

    await page.goto('/packs');
    const open = async (realm: string) => {
      await page
        .getByRole('listitem', { name: `${realm} pack` })
        .getByRole('button', { name: 'Open' })
        .click();
      await expect(page.locator('.opening')).toHaveAttribute('data-theme', realm.toLowerCase());
      await page.getByRole('button', { name: 'Tear it open' }).click();
    };
    // The first two packs are the scripted onboarding packs: open and skip them.
    for (const realm of ['Mossgrove', 'Starhollow']) {
      await open(realm);
      await page.getByRole('button', { name: 'Skip', exact: true }).click();
      await page.getByRole('button', { name: 'Back to the shelf' }).click();
    }

    // The forced pack: Reveal all stops at the featured Mythic until its moment ends.
    await open('Starhollow');
    await page.getByRole('button', { name: 'Reveal all' }).click();
    await expect(page.getByTestId('moment')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.reveal__card')).toHaveAttribute('data-rarity', 'mythic');
    await expect(page.getByRole('button', { name: 'See results' })).toBeDisabled();
    await expect(page.getByTestId('moment')).toHaveAttribute('data-beat', 'glitch', {
      timeout: 9000,
    });
    await expect(page.getByText('ERR_LUCK_OVERFLOW')).toBeVisible();
    await expect(page.getByTestId('moment')).toBeHidden({ timeout: 4000 });
    await page.getByRole('button', { name: 'See results' }).click();
    await expect(page.locator('.summary__card')).toHaveCount(5);
  });
});
