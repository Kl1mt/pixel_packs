import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import type * as ScoreModule from '../src/audio/music/score.js';
import type * as SynthModule from '../src/audio/music/synth.js';
import type * as TracksModule from '../src/audio/music/tracks.js';

const OUT = '../../docs/audio/music';

type Synth = typeof SynthModule;
type Tracks = typeof TracksModule;
type Score = typeof ScoreModule;

const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

/**
 * Renders the code-written music offline (two loops each) to MP3s for review:
 * `MUSIC_PREVIEW=1 pnpm --filter @pixel-packs/client e2e e2e/musicPreview.spec.ts`.
 */
const PREVIEWS = [
  { name: 'home-loop', track: 'home', layers: [] as string[], loops: 2 },
  { name: 'opening-loop-calm', track: 'opening', layers: [], loops: 2 },
  { name: 'opening-loop-epic', track: 'opening', layers: ['epic'], loops: 2 },
  { name: 'opening-loop-golden', track: 'opening', layers: ['epic', 'golden'], loops: 2 },
];

test('renders music previews', async ({ page }) => {
  test.skip(!process.env.MUSIC_PREVIEW || !hasFfmpeg, 'opt-in: MUSIC_PREVIEW=1, needs ffmpeg');
  test.setTimeout(180_000);
  await page.goto('/');
  mkdirSync(OUT, { recursive: true });
  for (const p of PREVIEWS) {
    const wav = await page.evaluate(async ({ track, layers, loops }) => {
      // Vite serves the sources; a computed path keeps TypeScript from resolving it.
      const dir = '/src/audio/music/';
      const { ChipSynth } = (await import(`${dir}synth.ts`)) as Synth;
      const { TRACKS } = (await import(`${dir}tracks.ts`)) as Tracks;
      const { beatsPerLoop, secondsPerBeat } = (await import(`${dir}score.ts`)) as Score;
      const t = TRACKS[track as keyof typeof TRACKS];
      const seconds = beatsPerLoop(t) * secondsPerBeat(t) * loops + 1.5;
      const sr = 44100;
      const ctx = new OfflineAudioContext(1, Math.ceil(sr * seconds), sr);
      const synth = new ChipSynth(ctx, ctx.destination);
      synth.play(t, layers);
      synth.schedule(seconds - 1.5);
      const d = (await ctx.startRendering()).getChannelData(0);
      return Array.from(d, (s) => Math.round(Math.max(-1, Math.min(1, s)) * 32767));
    }, p);
    const pcm = Buffer.alloc(wav.length * 2);
    wav.forEach((s, i) => pcm.writeInt16LE(s, i * 2));
    const raw = `${OUT}/${p.name}.pcm`;
    writeFileSync(raw, pcm);
    execFileSync('ffmpeg', [
      ...['-y', '-f', 's16le', '-ar', '44100', '-ac', '1', '-i', raw],
      ...['-c:a', 'libmp3lame', '-b:a', '64k', `${OUT}/${p.name}.mp3`],
    ]);
    rmSync(raw);
    expect(wav.some((s) => Math.abs(s) > 1000)).toBe(true);
  }
});
