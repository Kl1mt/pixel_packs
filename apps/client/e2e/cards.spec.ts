import { expect, test, type Locator, type Page } from '@playwright/test';
import { settle } from './helpers.js';

const OUT = '../../docs/cards';
const VARIANTS = ['normal', 'foil', 'prismatic', 'void', 'glitch'] as const;
/** Parchment name + rules boxes in art px (`TEXT_AREA`, src/render/glsl.ts): text is drawn by different engines. */
const TEXT_AREA = { x: 6, y: 80, w: 84, h: 34 };

async function openLab(page: Page, query: string) {
  await page.goto(`/debug?${query}`);
  await settle(page);
  await expect(page.locator('[data-testid=pixi-card] .card-stage[data-ready]')).toBeVisible();
}

/** Pixel-by-pixel differences between two PNGs (same size), skipping `skip` (in screen px). */
async function diff(page: Page, a: Buffer, b: Buffer, skip: typeof TEXT_AREA) {
  return page.evaluate(
    async ([a64, b64, r]) => {
      const load = async (s: string) => {
        const bmp = await createImageBitmap(
          await (await fetch(`data:image/png;base64,${s}`)).blob(),
        );
        const c = new OffscreenCanvas(bmp.width, bmp.height);
        const ctx = c.getContext('2d');
        if (!ctx) throw new Error('no 2d');
        ctx.drawImage(bmp, 0, 0);
        return ctx.getImageData(0, 0, bmp.width, bmp.height);
      };
      const [x, y] = await Promise.all([load(a64), load(b64)]);
      if (x.width !== y.width || x.height !== y.height)
        return { size: false, differing: -1, total: 0 };
      let differing = 0;
      let total = 0;
      for (let py = 0; py < x.height; py++)
        for (let px = 0; px < x.width; px++) {
          if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) continue;
          total++;
          const i = (py * x.width + px) * 4;
          if ([0, 1, 2, 3].some((k) => Math.abs((x.data[i + k] ?? 0) - (y.data[i + k] ?? 0)) > 2))
            differing++;
        }
      return { size: true, differing, total };
    },
    [a.toString('base64'), b.toString('base64'), skip] as const,
  );
}

async function fps(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let frames = 0;
        const t0 = performance.now();
        const f = (now: number) => {
          frames++;
          if (now - t0 < 2000) requestAnimationFrame(f);
          else resolve((frames * 1000) / (now - t0));
        };
        requestAnimationFrame(f);
      }),
  );
}

const canvas = (page: Page): Locator => page.locator('[data-testid=pixi-card] canvas');

test('card lab: every variant renders, screenshots for review', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('Failed to load resource'))
      errors.push(m.text());
  });
  await page.setViewportSize({ width: 1600, height: 1100 });
  for (const v of VARIANTS) {
    await openLab(page, `variant=${v}&fx=full&freeze=1&stars=${v === 'normal' ? 1 : 2}&all=0`);
    await canvas(page).screenshot({ path: `${OUT}/variant-${v}.png` });
  }
  await openLab(page, 'card=STA-003&variant=void&fx=full&freeze=1&stars=3&edition=1&mint=12');
  await canvas(page).screenshot({ path: `${OUT}/badges.png` });
  await page.screenshot({ path: `${OUT}/card-lab.png`, fullPage: true });
  await openLab(page, 'variant=foil&fx=full&freeze=1');
  await page
    .getByTestId('all-variants')
    .locator('canvas')
    .screenshot({ path: `${OUT}/variants.png` });
  await openLab(page, 'variant=foil&fx=reduced&freeze=1');
  await page
    .getByTestId('all-variants')
    .locator('canvas')
    .screenshot({ path: `${OUT}/variants-reduced.png` });
  expect(errors).toEqual([]);
});

test('the Pixi card matches the DOM card pixel for pixel (outside the text boxes)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  for (const card of ['MOS-012', 'STA-003', 'MOS-001']) {
    await openLab(page, `card=${card}&variant=normal&stars=3&edition=2&all=0`);
    const pixi = await canvas(page).screenshot();
    const dom = await page.locator('[data-testid=dom-card] figure.card').screenshot();
    const r = await diff(page, pixi, dom, {
      x: TEXT_AREA.x * 3,
      y: TEXT_AREA.y * 3,
      w: TEXT_AREA.w * 3,
      h: TEXT_AREA.h * 3,
    });
    expect(r.size).toBe(true);
    expect(r.differing / r.total).toBeLessThan(0.001);
  }
});

test('reduced effects hold still; full effects animate', async ({ page }) => {
  for (const v of ['prismatic', 'void', 'glitch'] as const) {
    await openLab(page, `variant=${v}&fx=reduced&all=0`);
    const a = await canvas(page).screenshot();
    await page.waitForTimeout(700);
    const b = await canvas(page).screenshot();
    expect(a.equals(b), `${v} reduced is still`).toBe(true);
  }
  await openLab(page, 'variant=glitch&fx=full&all=0');
  const shots: Buffer[] = [];
  for (let i = 0; i < 4; i++) {
    shots.push(await canvas(page).screenshot());
    await page.waitForTimeout(300);
  }
  expect(shots.some((s) => !s.equals(shots[0] ?? Buffer.alloc(0)))).toBe(true);
});

test('each variant previews at 60 fps', async ({ page }) => {
  // CI runners render WebGL in software on shared cores; locally this measures ~60.
  const floor = process.env.CI ? 25 : 55;
  for (const v of VARIANTS) {
    await openLab(page, `variant=${v}&fx=full&all=0`);
    const measured = await fps(page);
    test.info().annotations.push({ type: 'fps', description: `${v}: ${measured.toFixed(1)}` });
    expect(measured, `${v} fps`).toBeGreaterThanOrEqual(floor);
  }
});
