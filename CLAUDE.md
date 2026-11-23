# Pixel Packs — notes for Claude

Pixel Packs is a cozy pixel-fantasy pack-opening and collecting browser game. Trading, live rooms and an auto-battler come later.
- Design: `docs/GDD.md` (numbered sections, decision log in §29).
- Tasks: `docs/TASKS.md`.
- PixelLab reference: `docs/pixellab-api-notes.md` (created in T04).

## Working agreement (GDD §0) — always follow
1. **One task per session.** Do only the task the user names (e.g. "Do T05"). Extra work you discover becomes a new task in `docs/TASKS.md`.
2. **Start**:
   - Read the task's entry and its earlier handoff notes in `docs/TASKS.md`.
   - Read only the GDD sections the task lists.
   - Check that its dependencies are done and merged into `main`.
3. **Keep context lean**:
   - Don't open images, lockfiles, or generated or huge files. Never open the full PixelLab OpenAPI spec.
   - Trim command output (`| tail`, `| grep`).
   - Use subagents for wide searches.
   - Keep source files under ~300 lines.
4. **End**:
   1. Make sure typecheck, lint and tests pass.
   2. Update the task's status and handoff notes.
   3. If the design changed, update the GDD and its §29 decision log.
   4. Commit and push.
   5. Ask the user about a PR into `main`.
   6. Name the next task.
5. **No silent design changes.** Ask the user, or record the change in GDD §29.
6. **PixelLab**:
   - Check `GET https://api.pixellab.ai/v2/balance` first and stay within the task's budget.
   - Log every generation in `tools/artgen/manifest.json`.
   - The API key is injected by the session proxy. Never write keys into files.

## Conventions
- TypeScript strict, no `any`; Zod at every API boundary.
- Game rules live in `packages/shared` as pure, unit-tested functions. The server is authoritative for every economy action.
- UI follows GDD §16 (the anti-"AI look" rules). Pixel art is shown only at integer scale with `image-rendering: pixelated`.
- Commits follow Conventional Commits (`feat(client): …`, `fix(shared): …`).

## Commands
- `pnpm install` — install (Node 22, pnpm via Corepack).
- `pnpm dev` — client on :5173 + server on :3001; Vite proxies `/api` to the server.
- `pnpm typecheck` · `pnpm lint` (ESLint + Prettier check) · `pnpm test` (all Vitest projects) · `pnpm build` · `pnpm format`.
- `pnpm db:migrate` — apply migrations. PGlite by default (`apps/server/.data/pglite`); set `DATABASE_URL` for Postgres.
- `pnpm admin <command>` — admin CLI (grant currency/packs, reset onboarding, dev odds override); see `docs/api.md`.
- `pnpm --filter @pixel-packs/server db:generate` — create a migration from `apps/server/src/db/schema.ts`.
- One package: `pnpm --filter @pixel-packs/<client|server|shared|artgen|econ-sim|admin> <script>`; one test project: `pnpm test --project shared`.
- Shared code is consumed from source (`packages/shared/src/index.ts`); no build step needed.
