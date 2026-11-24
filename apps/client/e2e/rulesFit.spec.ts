import { expect, test } from '@playwright/test';
import { CARD_CATALOG, CARD_FACE, CARD_SCALE } from '@pixel-packs/shared';
import { RULES_LINE_HEIGHT, RULES_SIZE } from '../src/components/cardFace.js';
import type { PixiRulesMetrics } from '../src/pages/RulesLab.js';
import { settle } from './helpers.js';

const OUT = '../../docs/cards';
const BOX = { w: CARD_FACE.rules.w * CARD_SCALE, h: CARD_FACE.rules.h * CARD_SCALE };
const LINE = RULES_SIZE * RULES_LINE_HEIGHT;
/** Sub-pixel slack for rounding between layout and measurement. */
const EPS = 0.5;

interface DomFit {
  card: string;
  stars: number;
  box: { w: number; h: number };
  lines: number;
  widths: number[];
  fontSize: number;
}

/**
 * T24: every catalog card's compact face rules, at ★1–★3, fit the parchment box at 13 px in the
 * browser's real font — in the DOM card (line boxes from the layout) and in the Pixi card
 * (Pixi's own `CanvasTextMetrics`, the layout its `Text` draws).
 */
test('every card face rules text fits its box, DOM and Pixi, at every star level', async ({
  page,
}) => {
  await page.goto('/debug/rules');
  await settle(page);
  const metrics = page.getByTestId('pixi-rules-metrics');
  await expect(metrics).toBeAttached();
  const dom = await page.locator('.rules-lab__item').evaluateAll((items) =>
    items.map((item) => {
      const box = item.querySelector<HTMLElement>('.card__rules');
      if (!box) throw new Error('no rules box');
      const b = box.getBoundingClientRect();
      const lineTops = new Set<number>();
      const widths: number[] = [];
      for (const span of box.querySelectorAll('span')) {
        const range = document.createRange();
        range.selectNodeContents(span);
        // One rect per line box of the span; group fragments that share a line.
        const byTop = new Map<number, { l: number; r: number }>();
        for (const r of range.getClientRects()) {
          const top = Math.round(r.top);
          const cur = byTop.get(top);
          byTop.set(
            top,
            cur
              ? { l: Math.min(cur.l, r.left), r: Math.max(cur.r, r.right) }
              : { l: r.left, r: r.right },
          );
        }
        for (const [top, { l, r }] of byTop) {
          lineTops.add(top);
          widths.push(r - l);
        }
      }
      return {
        card: item.getAttribute('data-card') ?? '',
        stars: Number(item.getAttribute('data-stars')),
        box: { w: b.width, h: b.height },
        lines: lineTops.size,
        widths,
        fontSize: parseFloat(getComputedStyle(box).fontSize),
      } satisfies DomFit;
    }),
  );
  expect(dom).toHaveLength(CARD_CATALOG.length * 3);
  const pixi = JSON.parse((await metrics.textContent()) ?? '[]') as PixiRulesMetrics[];
  expect(pixi).toHaveLength(dom.length);

  for (const d of dom) {
    const at = `${d.card} ★${String(d.stars)}`;
    expect(d.box, at).toEqual(BOX);
    expect(d.fontSize, at).toBe(RULES_SIZE);
    expect(d.lines * LINE, `${at}: DOM lines`).toBeLessThanOrEqual(BOX.h + EPS);
    for (const w of d.widths) expect(w, `${at}: DOM line width`).toBeLessThanOrEqual(BOX.w + EPS);
    const p = pixi.find((x) => x.card === d.card && x.stars === d.stars);
    if (!p) throw new Error(`no Pixi metrics for ${at}`);
    expect(p.lineHeight, at).toBeCloseTo(LINE, 5);
    expect(p.lines * p.lineHeight, `${at}: Pixi lines`).toBeLessThanOrEqual(BOX.h + EPS);
    expect(p.maxLineWidth, `${at}: Pixi line width`).toBeLessThanOrEqual(BOX.w + EPS);
    // Same font, same box: both engines break the text the same way.
    expect(p.lines, `${at}: DOM vs Pixi lines`).toBe(d.lines);
  }
});

test('rules-fit screenshots: two-ability cards, Pixi above DOM', async ({ page }) => {
  await page.setViewportSize({ width: 1900, height: 1200 });
  for (const stars of [1, 3]) {
    await page.goto(
      `/debug/rules?cards=STA-012,STA-010,MOS-010,MOS-012,STA-013&stars=${String(stars)}&pixi=1`,
    );
    await settle(page);
    await expect(page.locator('.card-stage[data-ready]')).toBeVisible();
    await page.screenshot({ path: `${OUT}/rules-fit-star${String(stars)}.png`, fullPage: true });
  }
});
