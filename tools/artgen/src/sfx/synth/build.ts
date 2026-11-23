import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fromRepo } from '../../paths.js';
import type { SfxSpec } from '../spec.js';
import { buildSprite } from '../sprite.js';
import { encodeWav, renderSound } from './engine.js';
import { SOUNDS } from './sounds.js';

const run = promisify(execFile);
export const PREVIEW_DIR = 'docs/audio/sfx';

/** Clip ids of the spec that have no synth sound, and synth sounds no clip uses. */
export function synthCoverage(spec: SfxSpec): { missing: string[]; extra: string[] } {
  const ids = spec.clips.map((c) => c.id);
  return {
    missing: ids.filter((id) => !(id in SOUNDS)),
    extra: Object.keys(SOUNDS).filter((id) => !ids.includes(id)),
  };
}

/**
 * `artgen sfx-synth`: renders every clip of the spec with the code synth (no
 * generations), writes MP3 previews for review and builds the client sprite.
 */
export async function buildSynthSprite(spec: SfxSpec, log: (msg: string) => void): Promise<void> {
  const { missing, extra } = synthCoverage(spec);
  if (missing.length || extra.length) {
    throw new Error(`synth/spec mismatch: missing ${missing.join(',')} extra ${extra.join(',')}`);
  }
  const tmp = await mkdtemp(join(tmpdir(), 'sfx-synth-'));
  try {
    await mkdir(fromRepo(PREVIEW_DIR), { recursive: true });
    const picks = [];
    for (const clip of spec.clips) {
      const def = SOUNDS[clip.id];
      if (!def) continue;
      const file = join(tmp, `${clip.id}.wav`);
      await writeFile(file, encodeWav(renderSound(def)));
      await run('ffmpeg', [
        ...['-y', '-i', file, '-c:a', 'libmp3lame', '-b:a', '96k'],
        fromRepo(`${PREVIEW_DIR}/${clip.id}.mp3`),
      ]);
      picks.push({ id: clip.id, file });
    }
    await buildSprite(picks, log, { clean: false });
    log(`wrote ${String(picks.length)} previews to ${PREVIEW_DIR}/`);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}
