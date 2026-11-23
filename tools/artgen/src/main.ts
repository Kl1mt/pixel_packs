// PixelLab art generation pipeline (GDD §19). Usage: pnpm --filter @pixel-packs/artgen start <command>
import { writeFile, readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { createPixelLabClient } from './api/client.js';
import { galleryHtml } from './gallery/html.js';
import { startGalleryServer } from './gallery/server.js';
import { readManifest, ReviewSchema, setReview, totalSpend, writeManifest } from './manifest.js';
import { fromRepo } from './paths.js';
import { importJob } from './importJob.js';
import { promote } from './promote.js';
import { planJobs, runSpec } from './run.js';
import { loadSpec } from './spec.js';
import { uiSplit } from './ui.js';
import { composeT06, T06_PACK_NUMBERS } from './compose/t06.js';
import { buildStyleTile } from './styleTile/build.js';
import { writeArtLayout } from './artLayout/artLayout.js';
import { characterBoardCommand, characterCommand, characterLaneCommand } from './character/cli.js';

const USAGE = `artgen <command>
  balance                                  show remaining PixelLab generations
  run <spec.json> --budget <n> [--only a,b] [--dry-run]
                                           run a spec's jobs (skips completed ones)
  import <spec.json> <job> <job-status.json> [request.json]
                                           record a job that was run outside artgen
  gallery [--port 5180]                    local review gallery (approve/reject → manifest)
  export-gallery <out.html>                read-only gallery with embedded images
  review <entry> <index> <approved|rejected|pending> [note]
  promote <entry> <index> <dest.png> [--recentre]
                                           copy an approved candidate to its final path
                                           (--recentre: centre it horizontally, whole pixels)
  compose-t06                              build T06's final frames/packs/UI/icons/font from candidates
  style-tile                               write the static style tile page (apps/client/public/style-tile.html)
  art-layout                               write per-card art bottom-alignment (shared CARD_ART_DROP)
  ui-split <entry>                         split a create-ui-asset template into elements (free)
  character <spec.json> --budget <n> [--only a,b] [--dry-run]
                                           create characters + animations (T17, /create-character-v3)
  character-board <spec.json> <out.png>    animated side-by-side APNG of a character spec (free)
  character-lane <spec.json> <outDir> <left> <right> […]
                                           mock battle lane APNGs per character pair (free)
  spend                                    total generations logged in the manifest`;

const log = (msg: string) => {
  console.log(msg);
};

async function main(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      'dry-run': { type: 'boolean', default: false },
      only: { type: 'string' },
      budget: { type: 'string' },
      port: { type: 'string', default: '5180' },
      recentre: { type: 'boolean', default: false },
    },
  });
  const [command, ...rest] = positionals;
  // The cloud-session proxy injects the key; locally, PIXELLAB_API_KEY is sent instead.
  const client = createPixelLabClient({ apiKey: process.env.PIXELLAB_API_KEY, log });

  switch (command) {
    case 'balance': {
      const b = await client.balance();
      log(
        `${String(b.subscription.generations)} / ${String(b.subscription.total)} generations (${b.subscription.plan})`,
      );
      return;
    }
    case 'run': {
      const [specPath] = rest;
      if (!specPath) throw new Error('run needs a spec file');
      const budget = Number(values.budget);
      if (!Number.isInteger(budget) || budget < 0)
        throw new Error('run needs --budget <generations>');
      const spec = await loadSpec(fromRepo(specPath));
      const manifest = await readManifest();
      const only = values.only ? values.only.split(',') : [];
      const dryRun = values['dry-run'];
      if (!dryRun) {
        const { planned } = planJobs(spec, manifest, only, budget);
        const before = await client.balance();
        log(`balance: ${String(before.subscription.generations)} generations`);
        if (before.subscription.generations < planned)
          throw new Error('not enough generations left');
      }
      const result = await runSpec(spec, {
        client: dryRun ? null : client,
        manifest,
        dryRun,
        only,
        budget,
        log,
      });
      if (!dryRun) {
        const after = await client.balance();
        log(`spent ${String(result.spent)}; balance now ${String(after.subscription.generations)}`);
      }
      return;
    }
    case 'import': {
      const [specPath, jobId, statusPath, requestPath] = rest;
      if (!specPath || !jobId || !statusPath) throw new Error(USAGE);
      const spec = await loadSpec(fromRepo(specPath));
      const status: unknown = JSON.parse(await readFile(statusPath, 'utf8'));
      const sent = requestPath
        ? (JSON.parse(await readFile(requestPath, 'utf8')) as Record<string, unknown>)
        : undefined;
      await importJob(spec, jobId, status, await readManifest(), sent);
      log(`imported ${spec.id}/${jobId}`);
      return;
    }
    case 'gallery': {
      const port = Number(values.port);
      startGalleryServer(port);
      log(`review gallery on http://127.0.0.1:${String(port)}/ (Ctrl+C to stop)`);
      return;
    }
    case 'export-gallery': {
      const [out] = rest;
      if (!out) throw new Error('export-gallery needs an output path');
      const manifest = await readManifest();
      const images = new Map<string, string>();
      for (const e of manifest.entries) {
        for (const o of e.outputs) {
          const b64 = (await readFile(fromRepo(o.file))).toString('base64');
          images.set(o.file, `data:image/png;base64,${b64}`);
        }
      }
      const html = galleryHtml(manifest, { interactive: false, src: (f) => images.get(f) ?? '' });
      await writeFile(out, html);
      log(`wrote ${out}`);
      return;
    }
    case 'review': {
      const [entryId, index, review, note] = rest;
      if (!entryId || !index || !review) throw new Error(USAGE);
      const manifest = await readManifest();
      if (!setReview(manifest, entryId, Number(index), ReviewSchema.parse(review), note)) {
        throw new Error(`no candidate ${entryId} #${index}`);
      }
      await writeManifest(manifest);
      log(`${entryId} #${index} → ${review}`);
      return;
    }
    case 'promote': {
      const [entryId, index, dest] = rest;
      if (!entryId || !index || !dest) throw new Error(USAGE);
      const shift = await promote(await readManifest(), entryId, Number(index), dest, {
        recentre: values.recentre,
      });
      log(`${entryId} #${index} → ${dest}${shift ? ` (shifted ${String(shift)} px)` : ''}`);
      return;
    }
    case 'compose-t06': {
      await composeT06(log);
      return;
    }
    case 'style-tile': {
      log(`wrote ${await buildStyleTile(T06_PACK_NUMBERS)}`);
      return;
    }
    case 'art-layout': {
      log(`wrote ${await writeArtLayout()}`);
      return;
    }
    case 'ui-split': {
      const [entryId] = rest;
      if (!entryId) throw new Error(USAGE);
      await uiSplit(client, await readManifest(), entryId, log);
      return;
    }
    case 'character': {
      const args = { rest, budget: values.budget, only: values.only, dryRun: values['dry-run'] };
      await characterCommand(client, args, log);
      return;
    }
    case 'character-lane': {
      await characterLaneCommand(rest, log);
      return;
    }
    case 'character-board': {
      await characterBoardCommand(rest, log);
      return;
    }
    case 'spend': {
      log(`${String(totalSpend(await readManifest()))} generations logged`);
      return;
    }
    default:
      log(USAGE);
  }
}

main(process.argv.slice(2)).catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
