import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import {
  CARD_CATALOG,
  REALM_PALETTES,
  masterPaletteHex,
  realmPaletteHex,
} from '@pixel-packs/shared';
import {
  ENDPOINT_COST,
  uiCost,
  type ApiImage,
  type EndpointBody,
  type TargetPalette,
} from './api/schemas.js';
import { decodePng, encodePng } from './png.js';
import { fromRepo } from './paths.js';
import { cardArtPrompt } from './prompt.js';
import type { JobSpec } from './spec.js';

export function jobDescription(job: JobSpec): string {
  if (job.description !== undefined) return job.description;
  const card = CARD_CATALOG.find((c) => c.id === job.cardId);
  if (!card) throw new Error(`unknown card ${String(job.cardId)}`);
  return cardArtPrompt(card.artPrompt);
}

export function jobPalette(job: JobSpec): TargetPalette | undefined {
  if (job.palette === 'none') return undefined;
  if (job.palette === 'master') return { name: 'Pixel Packs master', colors: masterPaletteHex() };
  return { name: REALM_PALETTES[job.palette]?.name, colors: realmPaletteHex(job.palette) };
}

/** Estimated generations for one job (receipts in the manifest are the truth). */
export function jobCost(job: JobSpec): number {
  switch (job.endpoint) {
    case 'create-image-pro-flash':
      // /pro-flash/cost (2026-11-23): 5 up to 96×96 (incl. 64×96), 6 at 96×128.
      return job.size.width * job.size.height > 96 * 96 ? 6 : 5;
    case 'create-ui-asset':
      return uiCost(Math.max(job.size.width, job.size.height));
    case 'ui-assets/states':
      return uiCost(job.gridSide);
    default:
      return ENDPOINT_COST[job.endpoint];
  }
}

/** A 1-pixel-high strip of the palette colours: pixflux's forced-palette `color_image`. */
export function paletteImage(colors: string[]): Buffer {
  const png = new PNG({ width: colors.length, height: 1 });
  colors.forEach((hex, i) => {
    const v = Number.parseInt(hex.slice(1), 16);
    png.data.set([(v >> 16) & 255, (v >> 8) & 255, v & 255, 255], i * 4);
  });
  return encodePng(png);
}

async function loadImage(path: string) {
  const buf = await readFile(fromRepo(path));
  const { width, height } = decodePng(buf);
  const image: ApiImage = { type: 'base64', base64: buf.toString('base64'), format: 'png' };
  return { image, width, height };
}

export type AnyBody = EndpointBody[keyof EndpointBody];

export interface BuiltRequest {
  body: AnyBody;
  /** What the manifest records: the body with image data replaced by repo paths. */
  params: Record<string, unknown>;
}

export async function buildRequest(job: JobSpec): Promise<BuiltRequest> {
  const description = jobDescription(job);
  const palette = jobPalette(job);
  const common = {
    description,
    seed: job.seed,
    no_background: job.noBackground,
    target_palette: palette,
  };
  switch (job.endpoint) {
    case 'generate-image-v2': {
      const body = { ...common, image_size: job.size };
      return { body, params: { ...body } };
    }
    case 'generate-with-style-v2': {
      const style_images = await Promise.all(job.styleImages.map(loadImage));
      const body = { ...common, style_images, style_description: job.styleDescription };
      return { body, params: { ...body, style_images: job.styleImages } };
    }
    case 'create-image-pro-flash': {
      const style = job.styleImage === undefined ? undefined : await loadImage(job.styleImage);
      const body = {
        ...common,
        image_size: job.size,
        style_image: style && {
          image: style.image,
          size: { width: style.width, height: style.height },
          usage_description: job.styleUsage,
        },
        // The palette decides colour; the style image only lends outline/shading/detail.
        style_options: style && {
          color_palette: palette === undefined,
          outline: true,
          detail: true,
          shading: true,
        },
      };
      return { body, params: { ...body, style_image: job.styleImage } };
    }
    case 'create-image-pixflux': {
      const color_image: ApiImage | undefined = palette && {
        type: 'base64',
        base64: paletteImage(palette.colors).toString('base64'),
        format: 'png',
      };
      const body = {
        description,
        image_size: job.size,
        seed: job.seed,
        no_background: job.noBackground,
        color_image,
        outline: job.outline,
        shading: job.shading,
        detail: job.detail,
        view: job.view,
      };
      return { body, params: { ...body, color_image: palette && `palette:${job.palette}` } };
    }
    case 'generate-font-pro': {
      const body = {
        description,
        weight: job.weight,
        glyph_px: job.glyphPx,
        seed: job.seed,
        font_name: job.fontName,
      };
      return { body, params: { ...body } };
    }
    case 'create-ui-asset': {
      const style = job.styleImage === undefined ? undefined : await loadImage(job.styleImage);
      const body = {
        ...common,
        image_size: job.size,
        elements: job.elements,
        style_image: style?.image,
        name: job.id,
      };
      return { body, params: { ...body, style_image: job.styleImage } };
    }
    case 'ui-assets/states': {
      const body = { element_ids: job.elementIds, states: job.states, target_palette: palette };
      return { body, params: { ...body } };
    }
  }
}
