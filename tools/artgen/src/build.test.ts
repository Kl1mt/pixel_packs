import { describe, expect, it } from 'vitest';
import { masterPaletteHex } from '@pixel-packs/shared';
import type { PixfluxBody, ProFlashBody, UiStatesBody } from './api/schemas.js';
import { buildRequest, jobCost, paletteImage } from './build.js';
import { decodePng } from './png.js';
import { JobSpecSchema, type JobSpec } from './spec.js';
import { slug } from './ui.js';

const parse = (j: Record<string, unknown>): JobSpec =>
  JobSpecSchema.parse({ id: 'x', seed: 7, outDir: 'tools/artgen/candidates/test/x', ...j });

describe('jobCost', () => {
  it('prices each endpoint', () => {
    const pro = (w: number, h: number) =>
      parse({
        endpoint: 'create-image-pro-flash',
        description: 'd',
        size: { width: w, height: h },
      });
    expect(jobCost(pro(64, 96))).toBe(5);
    expect(jobCost(pro(96, 128))).toBe(6);
    expect(
      jobCost(
        parse({
          endpoint: 'create-image-pixflux',
          description: 'd',
          size: { width: 32, height: 32 },
        }),
      ),
    ).toBe(1);
    expect(
      jobCost(
        parse({ endpoint: 'generate-font-pro', description: 'd', weight: 'Bold', glyphPx: 16 }),
      ),
    ).toBe(15);
    const ui = (side: number) =>
      parse({ endpoint: 'create-ui-asset', description: 'd', size: { width: side, height: 192 } });
    expect([jobCost(ui(256)), jobCost(ui(320)), jobCost(ui(400))]).toEqual([10, 15, 25]);
  });
});

describe('buildRequest (T06 endpoints)', () => {
  it('turns the palette into a pixflux color_image strip', async () => {
    const job = parse({
      endpoint: 'create-image-pixflux',
      description: 'a gold coin icon',
      palette: 'master',
      size: { width: 32, height: 32 },
    });
    const { body, params } = await buildRequest(job);
    const png = decodePng(Buffer.from((body as PixfluxBody).color_image?.base64 ?? '', 'base64'));
    expect([png.width, png.height]).toEqual([masterPaletteHex().length, 1]);
    expect(params.color_image).toBe('palette:master');
  });

  it('records the pro-flash style image as a path and lets the palette decide colour', async () => {
    const job = parse({
      endpoint: 'create-image-pro-flash',
      description: 'a frame',
      palette: 'master',
      size: { width: 96, height: 128 },
      styleImage: 'tools/artgen/anchors/mossgrove/mos-003-burr-hoglet-01.png',
    });
    const { body, params } = await buildRequest(job);
    const b = body as ProFlashBody;
    expect(b.style_image?.size).toEqual({ width: 64, height: 64 });
    expect(b.style_options?.color_palette).toBe(false);
    expect(params.style_image).toBe('tools/artgen/anchors/mossgrove/mos-003-burr-hoglet-01.png');
  });

  it('builds a states body from element ids', async () => {
    const job = parse({
      endpoint: 'ui-assets/states',
      description: 'button states',
      elementIds: ['e1'],
      states: [{ name: 'hover', description: 'lighter' }],
    });
    const body = (await buildRequest(job)).body as UiStatesBody;
    expect(body.element_ids).toEqual(['e1']);
    expect(jobCost(job)).toBe(10);
  });
});

describe('helpers', () => {
  it('paletteImage keeps colour order', () => {
    const png = decodePng(paletteImage(['#ff0000', '#00ff00']));
    expect([...png.data.subarray(0, 8)]).toEqual([255, 0, 0, 255, 0, 255, 0, 255]);
  });

  it('slug numbers and kebab-cases element names', () => {
    expect(slug('Wood Panel', 2)).toBe('02-wood-panel');
    expect(slug(null, 1)).toBe('01-element');
  });
});
