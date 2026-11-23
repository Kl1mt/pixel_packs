import type { PixelLabClient } from '../api/client.js';
import { readManifest } from '../manifest.js';
import { fromRepo } from '../paths.js';
import { planSfx, runSfx } from './run.js';
import { loadSfxSpec } from './spec.js';
import { buildSprite } from './sprite.js';

export interface SfxCliOptions {
  budget: number;
  only: string[];
  retake: boolean;
  dryRun: boolean;
}

/** `artgen sfx`: makes missing clips (or one more take each with --retake), within --budget. */
export async function sfxCommand(
  client: PixelLabClient,
  specPath: string,
  opts: SfxCliOptions,
  log: (msg: string) => void,
): Promise<void> {
  const spec = await loadSfxSpec(fromRepo(specPath));
  const manifest = await readManifest();
  const plan = planSfx(spec, manifest, opts);
  for (const s of plan.skipped) log(`  skip ${s.clip}: ${s.reason}`);
  for (const r of plan.run) log(`  plan ${r.clip.id} take ${String(r.take)} (${String(r.cost)})`);
  log(`planned ${String(plan.planned)} generations for ${String(plan.run.length)} clips`);
  if (opts.dryRun || plan.run.length === 0) return;
  const before = await client.balance();
  log(`balance: ${String(before.subscription.generations)} generations`);
  if (before.subscription.generations < plan.planned) throw new Error('not enough generations');
  const spent = await runSfx(spec, { client, manifest, items: plan.run, log });
  const after = await client.balance();
  log(`spent ${String(spent)}; balance now ${String(after.subscription.generations)}`);
}

export async function sfxSpriteCommand(specPath: string, log: (msg: string) => void) {
  await buildSprite(await loadSfxSpec(fromRepo(specPath)), await readManifest(), log);
}
