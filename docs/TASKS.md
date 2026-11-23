# Task board

**One task = one Claude session** (see GDD §0). Start a session with "Do T‹nn›".
Status values: `todo` · `in progress` · `done` · `blocked`. At the end of a session, update the status and add **handoff notes** under the task.
Each task lists the GDD sections to read (§ = section of `docs/GDD.md`) and its PixelLab budget, if any. Size: S < M < L.

## M1 — Pack-opening vertical slice

| ID | Task | Depends on | Status |
|---|---|---|---|
| T00 | Design docs & working agreement | — | done |
| T01 | Monorepo scaffold & tooling | T00 | done |
| T02 | Game rules core (odds, pack roll, pity, scores) | T01 | done |
| T03 | Card set design: Mossgrove & Starhollow (26 cards) | T02 | done |
| T04 | PixelLab pipeline + style anchors | T01, T03 | done |
| T05 | Card art batch | T04 | todo |
| T06 | Frames, packs, UI art + style tile | T04 | todo |
| T07 | Client design system & app shell | T06 | todo |
| T08 | Database & email auth (API) | T02 | done |
| T09 | Auth screens + Discord login | T07, T08 | todo |
| T10 | Economy & pack API | T03, T08 | done |
| T11 | Card renderer & variant shaders | T05, T07 | todo |
| T12 | Pack opening I: core flow + Mossgrove theme | T10, T11 | todo |
| T13 | Pack opening II: Starhollow, Legendary/Mythic reveals, variant stingers | T12 | todo |
| T14 | Audio | T12 | todo |
| T15 | Binder, card inspect & pull history | T10, T11 | todo |
| T16 | Home & onboarding | T09, T12, T15 | todo |
| T17 | Character & idle-animation trial | T05 | todo |
| T18 | M1 QA & polish | all M1 | todo |

---

### T00 — Design docs & working agreement · done
- Wrote GDD v0.3, this task board, `CLAUDE.md` and `README.md`.
- **Handoff notes (2026-11-23)**: the repo had no commits; this is the first commit, pushed as `main` and as the session branch. The PixelLab balance was 1 163 / 2 000 generations, and the v2 API is at `https://api.pixellab.ai/v2` (spec at `/v2/openapi.json`, LLM docs at `/v2/llms.txt`). Next: T01.

### T01 — Monorepo scaffold & tooling · M · done
Docs: §21, §26
- **Workspaces** (pnpm):
  - `apps/client`: Vite + React + TS placeholder page.
  - `apps/server`: Fastify with `GET /api/health`.
  - `packages/shared`: an example function + test.
  - `tools/`: empty `artgen`, `econ-sim` and `admin` packages.
- **Tooling**: strict TS base config, ESLint (typescript-eslint) + Prettier, Vitest workspace. Root scripts: `dev`, `build`, `typecheck`, `lint`, `test`, `format`.
- **DB bootstrap**: Drizzle plus a driver factory (PGlite by default; `DATABASE_URL` switches to node-postgres) and `pnpm db:migrate` (no tables yet).
- **Dev proxy**: Vite forwards `/api` to the server.
- **CI**: a GitHub Actions workflow that installs, typechecks, lints and tests, with a Postgres service ready for later.
- **Repo files**: `.gitignore`, `.editorconfig`, `.nvmrc` (Node 22), `.env.example`.
- **README**: Windows setup (install Node 22 LTS → `corepack enable` → `pnpm install` → `pnpm dev`; Docker Postgres optional).
- Fill the **Commands** section of `CLAUDE.md`.
- Offer the user a cloud-environment setup script (`pnpm install`) so later sessions start ready.
- **Done when**: on a fresh clone, `pnpm install && pnpm typecheck && pnpm lint && pnpm test` passes; `pnpm dev` shows the client and `/api/health` answers through the proxy; CI is green.
- **Handoff notes (2026-11-23)**:
  - Versions: Node 22, pnpm 10.28 (pinned via `packageManager`), TypeScript 6.0 (typescript-eslint 8 doesn't support TS 7 yet), ESLint 10 flat config with `strictTypeChecked`, Vite 8, React 19, Vitest 5 (root `vitest.config.ts` lists the package projects), Fastify 5, Zod 4, Drizzle 0.45 + drizzle-kit, PGlite 0.5.
  - `packages/shared` is consumed from source (`exports` → `src/index.ts`); it holds `clampInt` (example) and `HealthResponseSchema`. T02 can replace the example.
  - Server: `buildApp()` in `apps/server/src/app.ts` (testable with `app.inject`), env parsed by Zod in `config.ts`, `createDb()` in `db/client.ts` returns `{ kind, db, close }`. Migrations run on server start and via `pnpm db:migrate`; `apps/server/drizzle/` holds an empty journal. T08 adds tables to `db/schema.ts` and runs `db:generate`.
  - PGlite data goes to `apps/server/.data/pglite` (git-ignored). The node-postgres path was verified locally against Postgres 16.
  - CI (`.github/workflows/ci.yml`) has a Postgres 17 service, exports `TEST_DATABASE_URL` for future integration tests, and runs `db:migrate` against it.
  - Markdown is excluded from Prettier so the hand-written docs keep their table/list layout.
  - Verified: fresh clone → install, typecheck, lint, test, build pass; `pnpm dev` served the page ("Server ok (pglite)") and `/api/health` through the Vite proxy. CI status: see the PR.

### T02 — Game rules core · M · done
Docs: §4, §5, §6, §7, §9 (dust values), §15, §17 (scripted packs)
- All code lives in `packages/shared` as pure functions with an injectable RNG.
- **Types** (Zod schemas): Realm, Rarity, Variant, Ability, Card, CardInstance traits, PackType.
- **`config/odds.ts`**: slot tables, featured slot, variant chances, realm split, pity groups and thresholds, Mythic pack table, per-realm composition, enabled realms (M1: Mossgrove and Starhollow).
- **Rules**:
  - pack roll (rarity → realm → card, featured slot, variant) and pity update;
  - scripted onboarding packs;
  - a mint-number interface (implemented in T10);
  - pull score, collection score, dust values.
- **RNG**: a seeded RNG utility (for M4) and a crypto RNG adapter.
- **Tests**:
  - 100k-roll statistics per pack type, and the rarity invariant (computed from the composition config);
  - exact pity counts, scripted packs, scores.
- **`tools/econ-sim` v0**: simulates N days of a free player with M1 sources and prints packs/day and time to complete a realm (with and without the Mythic).
- **Done when**: tests pass, and the econ-sim report is in the handoff notes.
- **Handoff notes (2026-11-23)**:
  - Layout of `packages/shared/src`: `model/` (Zod schemas: enums, `Card`, `Ability`, `CardInstanceTraits`, `PackType`, `PityCounters`, `PackRoll`), `config/odds.ts`, `rng/rng.ts`, `rules/` (weighted pick, catalog index, `rollPack`, `rollScriptedPack`, `revealOrder`, `featuredRarityOdds`, pity, scores, dust, craft costs, edition stamp, mint interface, analytic expectations), `testing/placeholderCatalog.ts`. Everything is re-exported from `index.ts`.
  - Odds are integer weights: rarities per mille, variants per 6000 (exact for 1/12 … 1/1500 and for the Mythic pack's ×3). Rolls draw `rng.int(total)`; `Rng` is just `{ int(max) }`.
  - RNG: `createSeededRng(seed)` (sfc32 + cyrb128, deterministic everywhere) and `createCryptoRng()` (Web Crypto `getRandomValues` + rejection sampling, so the shared package stays isomorphic; it is the server's pack RNG).
  - Rolling needs a `CatalogIndex` from `buildCatalogIndex(cards, enabledRealms)`, which validates the 4/3/2/2/1/1 composition per enabled realm and skips event cards. Until T03, tests and econ-sim use `buildPlaceholderCatalog()` (ids numbered by rarity). T03 should run its catalog through `buildCatalogIndex` in a test.
  - `rollPack(pack, pityOfItsGroup, index, rng)` returns 5 cards in slot order (slot 5 featured), the new counters, `pityTrigger` (`legendaryHard`/`mythicHard`/null) and the soft-pity bonus. Use `pityGroupOf(pack)` to pick the stored counters. `revealOrder()` gives the reveal sequence. Scripted packs: `rollScriptedPack(step 0|1, …)` returns the input counters unchanged.
  - Mint numbers: `needsMintNumber(variant)` + `MintNumberAllocator` interface for T10. `editionStampFor(source, packReleaseSeason, currentSeason)` is ready for T10 too.
  - Event packs are not in `PackTypeSchema` yet (their pity group would be `event:<id>`).
  - Design details settled here are in GDD §29 (2026-11-23, T02 rows).
  - `tools/econ-sim` v0 (`pnpm --filter @pixel-packs/econ-sim start [-- --days 90 --players 2000 --calendar 50 --seed s]`): free player, 3 free packs/day + calendar gold, all spent on Mossgrove packs (M1 realms), real pity, "Dust extras" (Normal copies beyond 9) and crafting of missing cards. Report (2 000 players, 90 days, calendar 50 gold/day):
    ```
    packs/day: 3.50
    days to complete a realm | median | p90 | ≤ 7 d | ≤ 21 d
    12 non-Mythic, luck only |      8 |   16 |  42 % |   97 %
    12 non-Mythic, + crafting|      8 |   16 |  42 % |   98 %
    all 13, luck only        |     19 |   33 |  10 % |   55 %
    all 13, + crafting       |     19 |   33 |  10 % |   56 %
    unspent dust at day 21 (median): 2420
    ```
    With the calendar at its low end (20 gold/day, 3.2 packs/day): 10 / 17 days for the 12, 21 / 37 days for all 13. So the §8 targets (≈1 week, Mythic ≈3 weeks) hold at the median, but the p90 is about twice the target, and crafting barely helps in M1 because "Dust extras" only dusts copies beyond 9 (≈2.4k dust by day 21 vs 12k for a Mythic). Worth a look when T10/M2 tune the calendar and quests (added to GDD §27).
  - Verified: `pnpm typecheck`, `pnpm lint`, `pnpm test` (63 tests; 100k-roll stats run in ~2 s) pass.

### T03 — Card set design: Mossgrove & Starhollow · M · done
Docs: §3, §4, §10 (ability semantics)
- **Cards**: 26 cards (13 per realm, composition as in §4) in `packages/shared/src/data/cards/{mossgrove,starhollow}.ts`. Each card has:
  - name and rarity;
  - ATK/HP within the power budget;
  - 1–2 structured abilities that fit the realm identity;
  - flavour text (≤ 90 chars);
  - an `artPrompt` (a critter description only; style words come from the template in §19).
- **Rules-text generator** (abilities → English text), with tests.
- **Catalog validation tests**: IDs, composition, budget, prompt present.
- **Lore**: a short blurb for each of the two realms in GDD §3.
- **User approval**: present the list as a table (names, concepts, rarities) and get approval before any art is made.
- **Done when**: tests pass and the user has approved the list.
- **Handoff notes (2026-11-23)**:
  - The user approved the 26-card list, the realm lore (now in GDD §3) and the two design decisions in GDD §29 (ATK + HP = power budget exactly in M1; ability semantics and enemy/ally target rule).
  - Data: `packages/shared/src/data/cards/{mossgrove,starhollow}.ts` via `defineRealmCards()` (`define.ts` fills id, `set1`, realm and flags; every card is craftable, none are event cards). `CARD_CATALOG`, `MOSSGROVE_CARDS`, `STARHOLLOW_CARDS`, `SET_ID` are exported from the package root. `POWER_BUDGET` lives in `config/power.ts`.
  - Rules text: `rules/rulesText.ts` — `abilityRulesText(ability)` (e.g. "When hurt: gain +1 ATK."), `cardRulesText(card)` (one line per ability), `isAbilityTargetValid()` and `KEYWORD_REMINDERS` (tooltip text for shield/thorns/regen/weaken). T11/T15 should render rules text from these, never hand-written strings.
  - Tests: `data/cards/catalog.test.ts` (Zod parse, `buildCatalogIndex`, id numbering by rarity, unique names, power budget, valid targets, flavour ≤ 90, art prompt present and free of style words) and `rules/rulesText.test.ts`.
  - `artPrompt` is the critter description only; T04/T05 wrap it in the GDD §19 template.
  - `tools/econ-sim` now uses `CARD_CATALOG` instead of the placeholder catalog (results unchanged: 9/15 days median/p90 for the 12 non-Mythic cards, 19/33 for all 13). `buildPlaceholderCatalog()` stays for generic rule tests.
  - Not done here (T10's job, per T08's notes): point `SERVER_CATALOG` in `apps/server/src/catalog.ts` at `CARD_CATALOG`.
  - Verified: `pnpm typecheck`, `pnpm lint`, `pnpm test` (104 tests) pass.

### T04 — PixelLab pipeline + style anchors · L · budget ≤ 40
Docs: §19
- **`tools/artgen`** command-line tool:
  - API client for `https://api.pixellab.ai/v2` (in cloud sessions the proxy injects the key) with background-job polling and retries with backoff;
  - spec files, manifest, output paths;
  - a static HTML review gallery where approve/reject writes back to the manifest;
  - flags `--dry-run`, `--only` and `--budget`.
- **`docs/pixellab-api-notes.md`**: a condensed reference for the endpoints we use, built from `/v2/llms.txt` or `/v2/openapi.json` (never commit the full spec), including the real cost per endpoint.
- **Palettes**: the master palette (~32 colours) plus Mossgrove and Starhollow sub-palettes.
- **Style anchors**: generate 3–4 candidates per realm (e.g. 1 Common + 1 Legendary, a few variations each). The **user picks** the anchors.
- **Done when**: the anchors are approved and committed, the manifest shows the spend, and the handoff notes record the exact `style_description` and parameters.
- **Handoff notes (2026-11-23)**:
  - **Spend**: 40 of 40 generations (4 × `/generate-image-v2` at 10 each). PixelLab balance went from 1163 to 1123. Everything is logged in `tools/artgen/manifest.json` (`pnpm --filter @pixel-packs/artgen start spend`).
  - **Budget finding (open in GDD §27)**: the Pro image endpoints charge 10 generations **per call** (16 candidates of one subject at 64×64), not per image. T05's 22 remaining cards therefore need ≈220 generations (+10 per retry), not ≤ 70. Settle T05's budget with the user before it starts.
  - **Tool**: `tools/artgen` (see its README).
    - Commands: `balance`, `run <spec> --budget n [--only a,b] [--dry-run]`, `import`, `gallery` (local server on :5180; approve/reject writes the manifest), `export-gallery`, `review`, `promote` (copies an approved candidate, never overwrites), `spend`.
    - Code: `src/api/` (client with retry/backoff and job polling, Zod schemas, `ENDPOINT_COST`), `spec.ts`, `manifest.ts`, `run.ts`, `prompt.ts` (the §19 template), `png.ts` (stats + numbered contact sheets), `gallery/`, `anchors.ts`.
    - The start script sets `NODE_USE_ENV_PROXY=1` so Node's `fetch` goes through the cloud proxy that injects the key. Locally, `PIXELLAB_API_KEY` is sent instead.
  - **Palettes**: `packages/shared/src/config/palettes.ts` holds `MASTER_PALETTE` (32 named colours), `REALM_PALETTES` (16 each for Mossgrove and Starhollow), `masterPaletteHex()` and `realmPaletteHex(realm)`. T07 can build its tokens from it.
  - **Anchors** (user picks A1, A4, B5, C2, C7, D5, D14): `tools/artgen/anchors/<realm>/*.png`, listed in `tools/artgen/anchors.json`.
    - Mossgrove: Burr Hoglet #1 and #4, Grandmother Morel #5.
    - Starhollow: Yawning Dormouse #2 and #7, Lady Lunamoth #5 and #14.
    - The first pick of each card is also its final card art: `apps/client/public/assets/cards/{MOS-003,MOS-012,STA-003,STA-012}.png`. T05 therefore has 22 cards left.
    - Lunamoth #14 has 7 opaque pixels on its right edge (a wing tip is clipped). The user kept it as a style reference, and it is not used as card art.
    - The candidates were made with `/generate-image-v2` at 64×64, `no_background: true`, the realm palette as `target_palette` and the §19 prompt template. Seeds: Hoglet 1101, Morel 1112, Dormouse 1203, Lunamoth 1212.
    - The Hoglet call was a manual probe. It sent the same Mossgrove colours in a different order, with the palette name "Mossgrove" and `style_options` (ignored without a style image). It is recorded with the exact body that was sent.
  - **T05 parameters** (from `anchors.json`):
    - Endpoint `/generate-with-style-v2`, one call per card. The output is 64×64 (it follows the anchors).
    - `style_images`: that realm's anchors (3 for Mossgrove, 4 for Starhollow; the API allows at most 4).
    - `target_palette`: `realmPaletteHex(realm)`, sent with the realm palette's `name`.
    - `no_background: true`.
    - `description`: `cardArtPrompt(card.artPrompt)`.
    - A recorded seed per job.
    - `style_description` (exact text):
      > Cozy whimsical storybook pixel art of a single fantasy critter as a 64x64 game sprite. Chunky, readable silhouette with round friendly shapes and big expressive eyes. Clean 1 px dark plum outline, soft 2-3 step shading lit from the top-left, small bright highlights, clean pixel clusters without dithering noise or blur. Muted, earthy realm palette. Transparent background, no ground, no shadow, no text, no frame.
  - **Baseline**: the art doesn't share one feet baseline yet. The bottom opaque row is y = 54 for Hoglet and y = 61 for the others. T05/T07 should align the art to a common baseline when placing it in the frame (e.g. bottom-align the bbox), not regenerate it.
  - **Repo contents**: all 64 candidates and their contact sheets stay in `tools/artgen/candidates/anchors/` (≈560 KB) so the manifest's review history resolves.
  - Verified: `pnpm typecheck`, `pnpm lint`, `pnpm test` pass.

### T05 — Card art batch · M · budget ≤ 70
Docs: §19
- Generate the remaining card art with the anchors and realm palettes.
- Show the review gallery and get **user approval**.
- Regenerate rejects (at most 2 retries, then revise the prompt).
- **Done when**: all 26 approved arts are committed as `apps/client/public/assets/cards/<id>.png` and the catalog art test passes.

### T06 — Frames, packs, UI art + style tile · L · budget ≤ 100 (was 60; raised by the user) · in review (style tile awaiting approval)
Docs: §4 (card face), §16, §19
- **Card**: 6 rarity frames (96×128, with pips and materials) and a card back.
- **Packs**: Mossgrove and Starhollow pack art.
- **UI**: 9-slice panels (parchment, wood) and buttons (3 states).
- **Icons and type**: pixel icons (gold, gem, Stardust, timer, navigation), a cursor, and the heading font (`/generate-font-pro` or an OFL fallback).
- **Style tile**: a static page showing the palette, type scale, panels, buttons, one complete card and one home-screen fragment. Needs **user approval**.
- **Done when**: the style tile is approved and the assets are committed.
- **Handoff notes (2026-11-23)**:
  - **Spend**: 85 of 100 generations (balance 958 → 888 while T05 ran in parallel), all in `tools/artgen/manifest.json` under spec `t06` (`tools/artgen/specs/t06.json`).
    - 2 × pro-flash at 96×128 (6 each): frame base, card back.
    - 2 × `/generate-with-style-v2` (10 each): packs.
    - 2 × `/create-ui-asset` (10 each): the first, with `elements`, came back as one composite window, so it was retried with explicit `pieces`.
    - 1 × `/ui-assets/states` (10): button hover, pressed, disabled.
    - 1 × `/generate-font-pro` (15).
    - 8 × pixflux (1 each): icons.
    - Measured costs are in `docs/pixellab-api-notes.md`.
  - **Final assets** (`apps/client/public/assets/`, built by `pnpm --filter @pixel-packs/artgen start compose-t06`, which is deterministic):
    - `frames/{common,uncommon,rare,epic,legendary,mythic}.png` (96×128) and `frames/back.png`.
    - `packs/{mossgrove,starhollow}.png` (64×64; the user picked Mossgrove #5 and Starhollow #6, set in `T06_PACK_NUMBERS`, `src/compose/t06.ts`).
    - `ui/panel-{parchment,wood}.png` (117×117, 9-slice) and `ui/button-{rest,hover,pressed,disabled}.png` (81×25).
    - `icons/{gold,gem,stardust,timer,nav-home,nav-packs,nav-binder,cursor}.png` (16×16).
    - `fonts/pixel-packs-hollow.ttf`.
  - **Frames**: the generated base is hand-tuned in `src/compose/frames.ts`:
    - the window is stretched to exactly 64×64 and cut out with a 1 px ink rim;
    - the text box is shortened by 15 rows;
    - the 4 generated sockets are replaced by 6 drawn pip sockets;
    - the wood ramp is swapped for each `FRAME_MATERIALS` ramp.
    - Leaf ornaments and the parchment name/rules boxes keep their colours.
    - The crest socket is left empty for the renderer.
    - The whole frame sits 2 px lower than generated (`TOP_PAD`), and an ink cap closes the crest ring, which the generator had cut off at the canvas top.
  - **Shared config for T07/T11**:
    - `packages/shared/src/config/cardFace.ts`: `CARD_FACE` rects (art window 16,17 64×64 · crest · name · rules · ATK/HP badges = the cream circle interiors at x 7 and 79 · 6 pips), `FRAME_MATERIALS`, `frameMaterialHex()`.
    - `packages/shared/src/config/uiArt.ts`: `UI_SCALE` = 2, `CARD_SCALE` = 3, `UI_PANELS` / `UI_BUTTON` 9-slice insets (CSS `border-image-slice` order), `ICONS`, `HEADING_FONT`.
  - **Style tile**: `apps/client/public/style-tile.html` (generated by `artgen style-tile`, don't hand-edit; open at `/style-tile.html` under `pnpm dev`), screenshot `docs/style-tile/style-tile.png`. Its CSS (`tools/artgen/src/styleTile/css.ts`) is a working reference for T07's tokens: palette CSS variables, the 4 type sizes, `border-image` panels and buttons, the pressed offset, focus ring, card positioning by `CARD_FACE`.
  - **Card names**: body serif, 20 px, or 18/16 px for names over 15/19 characters, with a 3 art px margin each side (`nameSize`, `src/styleTile/html.ts`). Every catalog name fits with ≥ 10 % headroom.
  - **Card art placement**: bottom-align the art in the window (the tile shifts it by `63 - bbox.y1`), on a flat two-band realm backdrop.
  - **Follow-ups (T07/T11)**:
    - Face rules text is a compact 13 px; give the full text at ≥ 16 px in inspect.
    - The Home icon is the roughest of the 8. If it reads poorly in T07, regenerate it (1 generation) or hand-pixel it.
    - Pip and badge positions are fixed in `CARD_FACE`; draw ATK/HP numbers centred in the badge rects.
  - **artgen additions**:
    - endpoints `create-image-pro-flash`, `create-image-pixflux`, `generate-font-pro`, `create-ui-asset` (with `pieces`), `ui-assets/states`;
    - commands `ui-split`, `compose-t06`, `style-tile`;
    - manifest entries may carry `extra` (ui asset ids, elements, states).
  - Verified: `pnpm typecheck`, `pnpm lint`, `pnpm test` pass.

### T07 — Client design system & app shell · M
Docs: §16, §18
- **Tokens**: palette, type, spacing in art pixels, shadows; plus font loading.
- **Components**: `Panel` (9-slice), `Button`, `CurrencyBadge`, and a DOM `Card` (frame, art, stats, pips, rules text).
- **Shell**: layout and navigation (Home · Packs · Binder), routing, and a settings store (reduced motion/effects, volume).
- **`/styleguide` route**, with a Playwright screenshot.
- **Done when**: the styleguide matches the approved style tile and the screenshot has been checked against §16.

### T08 — Database & email auth (API) · M · done
Docs: §21, §22
- **Drizzle schema + migrations**: users, sessions, wallets, ledger, cards (with catalog sync), user_cards (all traits, including mint and edition columns), pack_types, pack_inventory, pack_openings, pity_counters, mint_counters, daily_claims, seasons (seeded with Season 0).
- **Auth endpoints**: register, login, logout and me, with argon2id, session cookies, CSRF protection and rate limits.
- **Email flows**: verification and password reset, sent through a console mail transport.
- **Integration tests** on PGlite.
- **Done when**: tests pass and the auth flow works with curl.
- **Handoff notes (2026-11-23)**:
  - Schema in `apps/server/src/db/schema/{auth,economy}.ts` (re-exported by `schema.ts`); one migration `drizzle/0000_tricky_prism.sql`, with a hand-appended `INSERT` for Season 0. Extra table: `email_tokens`. Extra columns worth knowing: `users.onboarding_step`, `pack_types.{pity_group, release_season, enabled}`, `pack_openings.{idempotency_key (unique per user), cards jsonb, revealed_at}`, `user_cards.{edition_season, mint_number (unique per card+variant), pack_opening_id}`, `ledger.{currency, delta, user_card_id, pack_type_id, reason, ref_id, meta}`, `daily_claims.claim_key` (unique per user+kind, for no double claims). Wallet balances and pack counts have `>= 0` CHECKs. No prices on `pack_types` yet — T10 adds what it needs with a new migration.
  - Startup (`main.ts`): migrate → `syncCatalog(db, SERVER_CATALOG)` → `syncPackTypes(db)` (`db/sync.ts`). `SERVER_CATALOG` in `src/catalog.ts` is **empty**; **T10 must point it at the T03 catalog**. Removed cards are marked `retired`, never deleted. Pack type ids: `realm:<realm>`, `mythic` (`packTypeId()`).
  - Auth: `src/auth/{crypto,password,service,plugin,routes,emails}.ts`, `src/mail/mailer.ts` (console + memory mailers), `src/http/errors.ts` (`HttpError`, JSON error handler incl. Zod → 400). `requireAuth(req)` gives `{ user, sessionId }` or throws 401 — use it in T10's routes. `buildApp(deps)` is now async and takes `{ db, mailer, appOrigin, cookieSecure, rateLimit?, now? }`. Rate limits are per route via `config.rateLimit` (`@fastify/rate-limit`, `global: false`).
  - Shared: request/response schemas, `CSRF_HEADER`, `ApiErrorCode` and the username blocklist in `packages/shared/src/api/{auth,usernameBlocklist}.ts`. Endpoints and a curl walk-through are in `docs/api.md` (T10 adds its section there).
  - Tests: `src/testing/harness.ts` gives `createTestApp()` (in-memory PGlite + migrations, memory mailer, injectable clock) and a cookie-jar `Client` that sends the CSRF header. Integration tests run on PGlite only; CI still applies the migration to Postgres 17.
  - New env: `NODE_ENV`, `APP_ORIGIN` (email links), `COOKIE_SECURE` (default on in production). Deps: `@node-rs/argon2` (prebuilt binaries, works on Windows), `@fastify/cookie`, `@fastify/rate-limit`.
  - T09 needs client pages at `/verify-email?token=` and `/reset-password?token=`; the client must fetch `GET /api/auth/csrf` before its first mutation.
  - Design details settled here are in GDD §29 (T08 rows); the `trustProxy` question for the deploy is in §27.
  - Verified: `pnpm typecheck`, `pnpm lint`, `pnpm test` (91 tests) pass; the curl flow (csrf → register → me → verify-email → logout → login, plus a rejected POST without the CSRF header) works against `pnpm start` on PGlite.

### T09 — Auth screens + Discord login · M
Docs: §16, §22
- **Screens**: Login, Register and Reset, built with the design system.
- **Discord OAuth**: oauth_accounts and account linking. The README explains how to create the Discord application; the **user puts the client ID and secret into `.env`**.
- **E2E test** for email registration.
- **Done when**: a user can register and log in in the browser. Discord login works once credentials are set, and is cleanly hidden without them.

### T10 — Economy & pack API · L · done
Docs: §5, §6 (mint numbers), §7, §8, §9 (dust), §22
- **Wallet and free rewards**:
  - free-pack claim: every 8 h, up to 2 stored, realm chosen, added to the pack inventory;
  - daily calendar (7 days).
- **Buying packs**: add a pack to the inventory.
- **Opening packs**: takes an idempotency key and runs as one transaction: roll, pity, instances, mint numbers for Void/Glitch, ledger entries, opening record.
- **More endpoints**: resume the last opening; odds; paged pull history; dust (rules from §9).
- **`tools/admin`**: grant gold or packs, reset onboarding, dev-only odds override.
- **Integration tests**: atomicity, no double claims, idempotency, and concurrency on Postgres in CI.
- **Done when**: tests pass and the endpoints are documented briefly in `docs/api.md`.
- **Handoff notes (2026-11-23)**:
  - Endpoints, shapes, ledger reasons and the admin CLI are in `docs/api.md` (T10 section). Request/response schemas: `packages/shared/src/api/economy.ts`; new error codes `insufficientFunds`, `noPacks`, `notReady`, `alreadyClaimed`, `idempotencyConflict`, `packDisabled`, `cannotDust`.
  - Shared: `config/economy.ts` (prices, free-pack timer, calendar, starter satchel), `rules/rewards.ts` (`freePackStatus`/`claimFreePack` anchor maths, `utcDayKey`, calendar), `rules/dustExtras.ts` (`planDustExtras`, `canDust`, `isPlainCopy`), `rollDevOverridePack` in `rules/scripted.ts`. econ-sim now reads the price and calendar from config (results unchanged: 8/16 days median/p90 for the 12, 19/33 for all 13).
  - Server: `src/economy/{context,db,state,opening,mint,dust,odds,routes}.ts`; `buildApp` takes optional `rng`, `catalogIndex`, `allowDevOverrides` (main sets it to `NODE_ENV !== 'production'`). `SERVER_CATALOG` is now `CARD_CATALOG`, and `SERVER_CATALOG_INDEX` is built once at start. Registration creates the wallet with the free-pack anchor and grants the starter satchel.
  - Migration `0001_plain_thaddeus_ross.sql`: `wallets.free_pack_anchor`, `user_cards.{removed_at, removed_reason}`, `pack_purchases`, `dev_odds_overrides`. `pack_openings.cards` now stores `OpenedCard[]` (roll + `userCardId`, `mintNumber`, `edition`, `isNew`), so resume/history need no joins.
  - `apps/server` exports `./admin` (`src/admin/index.ts`: `findUser`, `grantCurrency`, `grantPacks`, `resetOnboarding`, `setOddsOverride`), used by `tools/admin` (`pnpm admin …`) and by tests.
  - Tests: `src/economy/{rewards,opening,dust,concurrency}.test.ts`. The harness now syncs catalog + pack types and has `newPlayer()` / `key()`. `concurrency.test.ts` uses Postgres when `TEST_DATABASE_URL` is set (CI) and PGlite otherwise; verified locally on Postgres 16 too.
  - For T12: the client drives "Resume reveal" from `pendingOpeningId` and must POST `/openings/:id/revealed` when the reveal finishes. Dev forcing exists server-side (`pnpm admin odds-override`, which needs the PGlite server stopped); a `/debug` page will need a small dev-only HTTP route on top of `setOddsOverride`.
  - For T16: the 5 account-bound starter cards (§17 step 4) have no endpoint yet; copies with `source: 'starter', account_bound: true` are already supported by the schema and by dusting rules.
  - Design details settled here are in GDD §29 (T10 rows).
  - Verified: `pnpm typecheck`, `pnpm lint`, `pnpm test` (141 tests) pass; curl flow (register → economy → open scripted pack → admin grant + glitch override → buy → open → calendar → free pack → history → odds) against `pnpm start` on Postgres.

### T11 — Card renderer & variant shaders · L
Docs: §4, §6, §18
- **PixiJS v8** in the client, with a Pixi card renderer that matches the DOM card.
- **Variant filters**: Foil, Prismatic, Void, Glitch, each with a reduced-effects version.
- **Badges** for stars, mint numbers and editions.
- **`/debug` page**: any card × variant × stars, with an FPS meter.
- The same renderer is used by the binder, inspect and reveal.
- **Done when**: every variant can be previewed at 60 fps and screenshots are in the handoff notes.

### T12 — Pack opening I: core flow + Mossgrove theme · L
Docs: §5, §7, §16
- **Pack shelf screen**: owned packs, buying, the odds "?" panel and the pity meter.
- **Opening scene framework**: drag-to-tear with a click fallback, and the Mossgrove theme (vines unwrap, petals fall).
- **Reveal**: a card stack with rarity glow on the backs, flips in ascending order with the featured slot last, and "Reveal all" / "Skip".
- **After the reveal**: a results summary (NEW badges, dupes, "Dust extras") and "Resume reveal".
- **Dev forcing** of results via `/debug`.
- **Done when**: the full loop works end-to-end against the API, with Playwright screenshots of each stage.

### T13 — Pack opening II: Starhollow, Legendary/Mythic reveals, variant stingers · L · budget ≤ 20 (VFX)
Docs: §5, §6, §7
- **Starhollow theme**: the moon clasp turns, stardust swirls.
- **Rarity moments**:
  - Epic: shake and light leaks.
  - Legendary: the unique reveal.
  - Mythic: the unique reveal, with Mossgrove and Starhollow mini-cutscenes.
- **Variant stingers**: Foil glint, Prismatic rainbow wash, Void implosion, Glitch tear + "ERR_LUCK_OVERFLOW".
- Reduced-effects versions of all of the above.
- **Done when**: every rarity × variant can be forced and has been reviewed with screenshots.

### T14 — Audio · M · budget ≤ 40
Docs: §20
- **Generate** through artgen: the SFX set, a home loop and an opening loop.
- **Audio manager**: Howler sprites, volumes, mute, and unlocking on the first interaction.
- **Hooks**: buttons, opening scenes, rewards.
- **Done when**: every event in §20 has a sound and the volume settings persist.

### T15 — Binder, card inspect & pull history · L
Docs: §9, §12
- **Binder book**: realm tabs, pages with page turns, silhouettes, stacks, filters and sorting, virtualisation.
- **Card inspect**: tilt, shader, lore, traits of each copy, and dusting with the safety rules.
- **Pull history** screen.
- **Done when**: it stays at 60 fps with 1 000+ owned copies and screenshots have been reviewed.

### T16 — Home & onboarding · M
Docs: §16, §17
- **Home screen**: Open Packs button, free-pack timer, daily calendar UI, wallet.
- **Onboarding flow**: courier intro, 2 scripted packs, binder tour, 5 account-bound starter cards; every step skippable.
- **E2E test**: a new user goes through onboarding to the home screen.
- **Done when**: a new account gets from registering to the home screen in ≤ 90 s.

### T17 — Character & idle-animation trial · M · budget ≤ 30
Docs: §19
- Take the Mossgrove Legendary and the Starhollow Mythic and make a character for each from its card art with `/create-character-v3`.
- Generate a south idle loop (binder) and the east idle/walk/attack/hurt animations using the §19 spec.
- Try the `view` options and compare consistency side by side.
- **User decides**: keep or drop the binder idle loops.
- Lock the battle-sprite spec (view, canvas, baseline) in GDD §19.
- **Done when**: the decision is recorded in GDD §29.

### T18 — M1 QA & polish · M
Docs: §16, §18, §26
- A full E2E run with screenshots, a review against the §16 checklist, and a performance pass.
- A README walkthrough from a clean clone, double-checking the Windows steps.
- Bug fixes and an econ-sim re-run.
- An M1 retrospective in the handoff notes.
- **Done when**: the user signs off M1. Next comes the M2 planning session.

---

## Later milestones
These are broken down into tasks in a planning session at the start of each milestone.

**M2 — Full set & progression**
- Card design for Hearthfire, Tidepool and Skyloft (39 cards), art batches (≈ 2 sessions), and 3 realm pack themes.
- Fusion (API + workbench UI), crafting, seasons + First-Edition stamps.
- Quests and account level, collection log and rewards, wishlist, share image.
- Analytics events, per-realm music, economy tuning.

**M3 — Social + alpha**
- Friends, trading (post office UI, escrow, limits), live opening rooms (Socket.IO), profiles and showcase, leaderboards.
- VPS alpha deploy: compose, Cloudflare Tunnel route, backups, SMTP, domain.

**M4 — Caravan March**
- Deterministic battle engine in `packages/shared`, realm bonuses and ability tuning.
- Battle sprite production (65 characters × 4 animations) and the battle renderer.
- Caravan editor, practice AI, async PvP ladder, battle quests and rewards.

**M5 — Village & seasons**
- Critter Village, season pass, event packs, admin panel.

**M6 — Launch prep**
- Gauntlet, Fair Play arena.
- Premium store + legal checklist.
- Launch reset and Founder titles.
- Later variants.
