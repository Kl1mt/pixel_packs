# artgen — PixelLab pipeline

Turns spec files into PixelLab API calls (GDD §19). API reference: `docs/pixellab-api-notes.md`.

```sh
pnpm --filter @pixel-packs/artgen start balance
pnpm --filter @pixel-packs/artgen start run tools/artgen/specs/anchors.json --budget 40 --dry-run
pnpm --filter @pixel-packs/artgen start run tools/artgen/specs/anchors.json --budget 40 [--only job-a,job-b]
pnpm --filter @pixel-packs/artgen start gallery            # http://127.0.0.1:5180, approve/reject → manifest
pnpm --filter @pixel-packs/artgen start export-gallery out.html
pnpm --filter @pixel-packs/artgen start review <entry> <index> approved|rejected|pending [note]
pnpm --filter @pixel-packs/artgen start promote <entry> <index> apps/client/public/assets/cards/<id>.png [--recentre]
pnpm --filter @pixel-packs/artgen start spend
```

- **Specs** (`specs/*.json`, schema in `src/spec.ts`): jobs for `generate-image-v2` or `generate-with-style-v2`. A job names a `cardId` (its `artPrompt` is wrapped in the §19 template, `src/prompt.ts`) or a raw `description`, plus `palette` (a realm, `master` or `none`), `seed` and `outDir`.
- **Run**: checks the balance, skips jobs already completed in the manifest, stops at `--budget` (generations, required), writes candidates as `<outDir>/NN.png` plus a numbered 4× `sheet.png`, and appends each job to `manifest.json` straight away.
- **Manifest** (`manifest.json`, machine-written): endpoint, params (image data replaced by paths), seed, background job id, cost (generations and USD), status, and review state per candidate.
- **Promote**: approved files are immutable; `promote` refuses to overwrite. `--recentre` shifts the sprite horizontally by whole pixels so its opaque bbox is centred (no resampling); the card art test (`src/cardArt.test.ts`) accepts such shifts of an approved candidate.
- The key is injected by the cloud proxy (`NODE_USE_ENV_PROXY=1` in the start script makes Node's `fetch` use it). Locally, set `PIXELLAB_API_KEY`.
- Approved style anchors and their `style_description`: `anchors.json`.
