import type { PixelLabClient } from '../api/client.js';
import { readManifest } from '../manifest.js';
import { fromRepo } from '../paths.js';
import { writeCharacterBoard } from './board.js';
import { animationStats } from './stats.js';
import { laneApng, stackLanes, viewLane } from './lane.js';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { planCharacterJobs, runCharacterSpec } from './run.js';
import { loadCharacterSpec } from './spec.js';

export interface CharacterCliArgs {
  rest: string[];
  budget: string | undefined;
  only: string | undefined;
  dryRun: boolean;
}

/** `artgen character <spec> --budget n [--only a,b] [--dry-run]` */
export async function characterCommand(
  client: PixelLabClient,
  args: CharacterCliArgs,
  log: (msg: string) => void,
): Promise<void> {
  const [specPath] = args.rest;
  if (!specPath) throw new Error('character needs a spec file');
  const budget = Number(args.budget);
  if (!Number.isInteger(budget) || budget < 0)
    throw new Error('character needs --budget <generations>');
  const spec = await loadCharacterSpec(fromRepo(specPath));
  const manifest = await readManifest();
  const only = args.only ? args.only.split(',') : [];
  if (!args.dryRun) {
    const { planned } = planCharacterJobs(spec, manifest, only, budget);
    const before = await client.balance();
    log(`balance: ${String(before.subscription.generations)} generations`);
    if (before.subscription.generations < planned) throw new Error('not enough generations left');
  }
  const result = await runCharacterSpec(spec, {
    client: args.dryRun ? null : client,
    manifest,
    dryRun: args.dryRun,
    only,
    budget,
    log,
  });
  if (!args.dryRun) {
    const after = await client.balance();
    log(`spent ${String(result.spent)}; balance now ${String(after.subscription.generations)}`);
  }
}

/** `artgen character-board <spec> <out.png>`: animated side-by-side APNG (free). */
export async function characterBoardCommand(
  rest: string[],
  log: (msg: string) => void,
): Promise<void> {
  const [specPath, out] = rest;
  if (!specPath || !out) throw new Error('character-board needs <spec> <out.png>');
  const spec = await loadCharacterSpec(fromRepo(specPath));
  const manifest = await readManifest();
  const labels = await writeCharacterBoard(spec, manifest, out);
  log(`wrote ${out} (columns: ${labels.join(' · ')})`);
  for (const s of await animationStats(spec, manifest)) {
    log(
      `${s.id.padEnd(26)} ${String(s.frames)}f ${s.size} feet y ${s.baselines.join(',')} · bbox w ${s.bboxW.join('–')} h ${s.bboxH.join('–')} · ${String(s.colours)} colours${s.touchesEdge ? ' · TOUCHES EDGE' : ''}`,
    );
  }
}

/**
 * `artgen character-lane <spec> <outDir> <left> <right> [<left> <right>…]`: one mock
 * battle lane APNG per character pair (lane-1.png, …) plus all lanes stacked (lanes.png).
 */
export async function characterLaneCommand(
  rest: string[],
  log: (msg: string) => void,
): Promise<void> {
  const [specPath, outDir, ...pairs] = rest;
  if (!specPath || !outDir || pairs.length < 2 || pairs.length % 2 !== 0)
    throw new Error('character-lane needs <spec> <outDir> <left> <right> [...]');
  const spec = await loadCharacterSpec(fromRepo(specPath));
  const manifest = await readManifest();
  const dir = fromRepo(outDir);
  await mkdir(dir, { recursive: true });
  const lanes = [];
  for (let i = 0; i < pairs.length; i += 2) {
    const [l, r] = [pairs[i] ?? '', pairs[i + 1] ?? ''];
    const lane = await viewLane(spec, manifest, l, r);
    lanes.push(lane);
    const file = join(outDir, `lane-${l}-vs-${r}.png`);
    await writeFile(fromRepo(file), laneApng(lane));
    log(`wrote ${file}`);
  }
  await writeFile(join(dir, 'lanes.png'), laneApng(stackLanes(lanes)));
  log(`wrote ${join(outDir, 'lanes.png')}`);
}
