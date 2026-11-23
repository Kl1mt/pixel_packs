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
| T04 | PixelLab pipeline + style anchors | T01, T03 | todo |
| T05 | Card art batch | T04 | todo |
| T06 | Frames, packs, UI art + style tile | T04 | todo |
| T07 | Client design system & app shell | T06 | todo |
| T08 | Database & email auth (API) | T02 | done |
| T09 | Auth screens + Discord login | T07, T08 | todo |
| T10 | Economy & pack API | T03, T08 | todo |
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

### T05 — Card art batch · M · budget ≤ 70
Docs: §19
- Generate the remaining card art with the anchors and realm palettes.
- Show the review gallery and get **user approval**.
- Regenerate rejects (at most 2 retries, then revise the prompt).
- **Done when**: all 26 approved arts are committed as `apps/client/public/assets/cards/<id>.png` and the catalog art test passes.

### T06 — Frames, packs, UI art + style tile · L · budget ≤ 60
Docs: §4 (card face), §16, §19
- **Card**: 6 rarity frames (96×128, with pips and materials) and a card back.
- **Packs**: Mossgrove and Starhollow pack art.
- **UI**: 9-slice panels (parchment, wood) and buttons (3 states).
- **Icons and type**: pixel icons (gold, gem, Stardust, timer, navigation), a cursor, and the heading font (`/generate-font-pro` or an OFL fallback).
- **Style tile**: a static page showing the palette, type scale, panels, buttons, one complete card and one home-screen fragment. Needs **user approval**.
- **Done when**: the style tile is approved and the assets are committed.

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

### T10 — Economy & pack API · L
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
