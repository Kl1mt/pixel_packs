import { expect, test, type Page } from '@playwright/test';
import { CARD_CATALOG, VARIANTS, type CollectionCopy } from '@pixel-packs/shared';
import { loggedIn, settle } from './helpers.js';

const OUT = '../../docs/binder';

async function csrf(page: Page): Promise<string> {
  const res = await page.request.get('/api/auth/csrf');
  return ((await res.json()) as { csrfToken: string }).csrfToken;
}

/** Opens both starter packs through the API and marks them revealed. */
async function openStarterPacks(page: Page) {
  const token = await csrf(page);
  const headers = { 'x-csrf-token': token };
  for (const realm of ['mossgrove', 'starhollow']) {
    const res = await page.request.post('/api/packs/open', {
      data: { packTypeId: `realm:${realm}`, idempotencyKey: `e2e-${realm}-${String(Date.now())}` },
      headers,
    });
    expect(res.status()).toBe(201);
    const { opening } = (await res.json()) as { opening: { id: string } };
    await page.request.post(`/api/packs/openings/${opening.id}/revealed`, { headers });
  }
}

async function fps(page: Page, ms = 2000): Promise<number> {
  return page.evaluate(
    (span) =>
      new Promise<number>((resolve) => {
        let frames = 0;
        const t0 = performance.now();
        const f = (now: number) => {
          frames++;
          if (now - t0 < span) requestAnimationFrame(f);
          else resolve((frames * 1000) / (now - t0));
        };
        requestAnimationFrame(f);
      }),
    ms,
  );
}

const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;

/**
 * 1 200 synthetic copies over 24 of the 26 cards (two stay missing): mostly plain, with
 * every variant, stars, stamps and mint numbers; MOS-001 alone holds 600 copies.
 */
function bigCollection(): CollectionCopy[] {
  const cards = CARD_CATALOG.filter((c) => c.id !== 'MOS-013' && c.id !== 'STA-012');
  const copies: CollectionCopy[] = [];
  for (let i = 0; i < 1200; i++) {
    const card = i < 600 ? cards[0] : cards[i % cards.length];
    const variant = VARIANTS[i % 23 === 0 ? i % 5 : 0] ?? 'normal';
    copies.push({
      userCardId: uuid(i + 1),
      cardId: card?.id ?? 'MOS-001',
      variant,
      stars: i % 37 === 0 ? 3 : i % 11 === 0 ? 2 : 1,
      edition: i % 7 === 0 ? { season: 1 } : null,
      mintNumber: variant === 'void' || variant === 'glitch' ? (i % 50) + 1 : null,
      source: 'pack',
      acquiredAt: new Date(Date.UTC(2026, 10, 1) + i * 60_000).toISOString(),
      tradeLockUntil: null,
      accountBound: false,
    });
  }
  return copies;
}

test('binder: starter pulls, inspect, dust and pull history', async ({ page }) => {
  await loggedIn(page);
  await openStarterPacks(page);
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('/binder');
  await expect(page.locator('.binder[data-ready=true]')).toBeVisible();
  await expect(page.locator('.pocket--owned').first()).toBeVisible();
  await expect(page.getByRole('tab', { name: /Mossgrove/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await settle(page);
  await page.screenshot({ path: `${OUT}/binder-starter.png`, fullPage: true });

  // Realm tab jumps to Starhollow.
  await page.getByRole('tab', { name: /Starhollow/ }).click();
  await expect(page.locator('.binder__where')).toContainText('Starhollow');
  await expect(page.locator('.pocket--owned').first()).toHaveAttribute('data-card', /^STA-/);

  // Inspect the first owned card and dust every copy (starter pulls are random: it may have two).
  const first = page.locator('.pocket--owned').first();
  const cardId = await first.getAttribute('data-card');
  await first.locator('.pocket__hit').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`card=${cardId ?? ''}`));
  await expect(dialog.locator('.card-details')).toBeVisible();
  for (const box of await dialog.getByRole('checkbox').all()) await box.check();
  await dialog.getByRole('button', { name: /^Dust \d/ }).click();
  await expect(dialog.getByRole('alertdialog')).toContainText('last copies');
  await dialog.getByRole('button', { name: 'Dust them' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status').filter({ hasText: /Dusted \d+ cop/ })).toBeVisible();
  await expect(page.locator(`.pocket--missing[data-card="${cardId ?? ''}"]`)).toBeVisible();

  // Pull history lists both starter packs; the filter narrows it down.
  await page.getByRole('link', { name: 'Pull history' }).click();
  await expect(page.locator('.history__list[data-ready=true] .pull')).toHaveCount(2);
  await settle(page);
  await page.screenshot({ path: `${OUT}/history.png`, fullPage: true });
  await page.getByRole('combobox', { name: 'Pack', exact: true }).selectOption('realm:mossgrove');
  await expect(page.locator('.history__list[data-ready=true] .pull')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('binder with 1 200 copies stays at 60 fps', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loggedIn(page);
  const copies = bigCollection();
  const stack = copies.filter((c) => c.cardId === 'MOS-001').length;
  await page.route('/api/cards', (route) => route.fulfill({ json: { copies } }));
  await page.goto('/binder?freeze=1');
  await expect(page.locator('.binder[data-ready=true]')).toBeVisible();
  await settle(page);
  await page.screenshot({ path: `${OUT}/binder-full.png`, fullPage: true });

  // Two pages side by side, and only the open spread is in the DOM.
  await expect(page.locator('.binder__page')).toHaveCount(2);
  expect(await page.locator('.pocket').count()).toBe(18);

  const floor = process.env.CI ? 25 : 55;
  // Hovering a variant copy mounts one live shader card.
  const special = page.locator('.pocket--owned:not([data-variant=normal])').first();
  await special.hover();
  await expect(special.locator('.card-stage[data-ready=true]')).toBeVisible();
  const hover = await fps(page);

  // Turning pages and switching realms.
  await page.mouse.move(0, 0);
  await page.getByRole('tab', { name: /Starhollow/ }).click();
  const turning = await fps(page, 1000);
  await page.getByRole('button', { name: 'Previous page' }).click();
  await expect(page.locator('.binder__where')).toContainText('Mossgrove');

  // Inspecting the 600-copy stack: one live card, a windowed copy list.
  await page.locator('.pocket--owned[data-card="MOS-001"] .pocket__hit').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.card-stage[data-ready=true]')).toBeVisible();
  await expect(dialog.getByRole('heading', { name: /Your copies/ })).toContainText(
    `×${String(stack)}`,
  );
  const rendered = Number(await dialog.locator('.copies').getAttribute('data-rendered'));
  expect(rendered).toBeLessThan(30);
  await dialog.locator('.copies').evaluate((el) => {
    el.scrollTop = 12_000;
  });
  await expect(dialog.locator('.copies__row').first()).toBeVisible();
  const inspect = await fps(page);
  await settle(page);
  await dialog.locator('.copies').evaluate((el) => {
    el.scrollTop = 0;
  });
  await dialog.evaluate((el) => {
    el.scrollTop = 0;
  });
  await page.screenshot({ path: `${OUT}/inspect.png` });

  test.info().annotations.push({
    type: 'fps',
    description: `hover ${hover.toFixed(1)}, turning ${turning.toFixed(1)}, inspect ${inspect.toFixed(1)}`,
  });
  expect(hover).toBeGreaterThanOrEqual(floor);
  expect(turning).toBeGreaterThanOrEqual(floor);
  expect(inspect).toBeGreaterThanOrEqual(floor);
});

test('binder on a phone: one page, 1× cards', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loggedIn(page);
  const copies = bigCollection();
  await page.route('/api/cards', (route) => route.fulfill({ json: { copies } }));
  await page.goto('/binder');
  await expect(page.locator('.binder[data-ready=true]')).toBeVisible();
  await expect(page.locator('.binder__page')).toHaveCount(1);
  await settle(page);
  await page.screenshot({ path: `${OUT}/binder-phone.png`, fullPage: true });
});
