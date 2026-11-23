# Pixel Packs

A cozy pixel-fantasy pack-opening and collecting game for the browser. Rip open themed packs, chase Void and Glitch variants, fill your binder, trade with friends, and (later) send your critters into auto-battles.

**Status:** pre-production.

- Game design document: [`docs/GDD.md`](docs/GDD.md)
- Task board: [`docs/TASKS.md`](docs/TASKS.md)

## Setup (Windows, macOS, Linux)

You only need Node — the dev database is embedded (PGlite).

1. Install **Node 22 LTS** from <https://nodejs.org> (on Windows, the `.msi` installer; or `nvm use` with [nvm-windows](https://github.com/coreybutler/nvm-windows) — see `.nvmrc`).
2. Open a terminal (PowerShell is fine) and enable pnpm through Corepack:
   ```sh
   corepack enable
   ```
   On Windows, run this once in a terminal opened **as Administrator**.
3. In the repo folder, install dependencies:
   ```sh
   pnpm install
   ```
4. Optional: copy `.env.example` to `.env` and adjust it.
5. Start the client and server:
   ```sh
   pnpm dev
   ```
   Open <http://localhost:5173>. The page should say "Server ok (pglite)"; <http://localhost:5173/api/health> is proxied to the server on port 3001.

### Optional: Docker Postgres instead of PGlite

```sh
docker run -d --name pixel-pg -p 5432:5432 -e POSTGRES_USER=pixel -e POSTGRES_PASSWORD=pixel -e POSTGRES_DB=pixel_packs postgres:17
```

Then set `DATABASE_URL=postgres://pixel:pixel@localhost:5432/pixel_packs` in `.env`. Leave it empty to go back to PGlite (data in `apps/server/.data/`).

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Client (Vite, :5173) + server (Fastify, :3001) with reload |
| `pnpm build` | Build every package |
| `pnpm typecheck` | `tsc` in every package |
| `pnpm lint` | ESLint + Prettier check |
| `pnpm test` | All Vitest projects |
| `pnpm format` | Prettier write |
| `pnpm db:migrate` | Apply Drizzle migrations (PGlite, or `DATABASE_URL`) |

## Layout

- `apps/client` — React + Vite
- `apps/server` — Fastify API under `/api`, Drizzle (migrations in `apps/server/drizzle`)
- `packages/shared` — pure game rules and Zod schemas shared by client and server
- `tools/artgen`, `tools/econ-sim`, `tools/admin` — command-line tools
