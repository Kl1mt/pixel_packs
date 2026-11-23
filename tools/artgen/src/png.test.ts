import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { contactSheet, decodePng, encodePng, imageStats } from './png.js';
import { galleryHtml } from './gallery/html.js';

function sprite(w: number, h: number, pixels: [number, number][]): PNG {
  const png = new PNG({ width: w, height: h });
  for (const [x, y] of pixels) png.data.set([200, 50, 50, 255], (y * w + x) * 4);
  return png;
}

describe('png helpers', () => {
  it('measures opaque pixels, bbox, colours and edge contact', () => {
    const s = imageStats(
      decodePng(
        encodePng(
          sprite(8, 8, [
            [2, 3],
            [4, 5],
          ]),
        ),
      ),
    );
    expect(s).toMatchObject({
      opaque: 2,
      colours: 1,
      bbox: { x0: 2, y0: 3, x1: 4, y1: 5 },
      touchesEdge: false,
    });
    expect(imageStats(sprite(8, 8, [[7, 1]])).touchesEdge).toBe(true);
    expect(imageStats(sprite(8, 8, [])).bbox).toBeNull();
  });

  it('builds a contact sheet at integer scale', () => {
    const sheet = contactSheet(
      [sprite(16, 16, [[1, 1]]), sprite(16, 16, []), sprite(16, 16, [])],
      2,
      4,
    );
    expect(sheet.width).toBe(2 * (64 + 8) + 8);
    expect(sheet.height).toBe(2 * (64 + 14 + 8) + 8);
  });
});

describe('gallery html', () => {
  const manifest = {
    version: 1 as const,
    entries: [
      {
        id: 's/a',
        spec: 's',
        job: 'a',
        endpoint: 'generate-image-v2',
        params: { description: '<b>snail</b>' },
        seed: 1,
        status: 'completed' as const,
        cost: { generations: 10 },
        createdAt: '',
        outputs: [{ index: 1, file: 'a/01.png', review: 'approved' as const, note: 'nice' }],
      },
    ],
  };

  it('escapes text and only adds review buttons when interactive', () => {
    const live = galleryHtml(manifest, { interactive: true, src: (f) => `/files/${f}` });
    expect(live).toContain('&#60;b&#62;snail');
    expect(live).toContain('data-r="approved"');
    expect(live).toContain('image-rendering:pixelated');
    const fixed = galleryHtml(manifest, { interactive: false, src: () => 'data:' });
    expect(fixed).not.toContain('<script>');
    expect(fixed).toContain('approved — nice');
  });
});
