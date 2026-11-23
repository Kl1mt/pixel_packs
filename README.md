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
   Open <http://localhost:5173> and make an account (sign-up emails are printed in the server console). <http://localhost:5173/api/health> is proxied to the server on port 3001.

### Optional: Discord login

Email login always works. "Log in with Discord" appears only once the server has Discord credentials; without them the buttons are hidden.

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and log in.
2. Click **New Application**, name it (e.g. "Pixel Packs (dev)"), accept the terms and click **Create**.
3. Optional: on **General Information**, add an app icon and a description; players see them on the consent screen.
4. Go to **OAuth2** in the left menu.
5. Under **Client information**, copy the **Client ID**. Click **Reset Secret**, confirm, and copy the **Client Secret** (it is shown only once).
6. Under **Redirects**, click **Add Redirect** and enter exactly
   ```
   http://localhost:5173/api/auth/discord/callback
   ```
   Click **Save Changes**. (For a deployed server, add `https://<your domain>/api/auth/discord/callback` too.)
7. Copy `.env.example` to `.env` (if you haven't yet) and fill in:
   ```sh
   DISCORD_CLIENT_ID=<the Client ID>
   DISCORD_CLIENT_SECRET=<the Client Secret>
   ```
   If your client runs somewhere other than `http://localhost:5173`, set `APP_ORIGIN` to it; the redirect is `${APP_ORIGIN}/api/auth/discord/callback` unless you set `DISCORD_REDIRECT_URI`.
8. Restart `pnpm dev`. The server log says "Discord login enabled", and the login page shows **Log in with Discord**. Logged-in players can link Discord under **Settings → Account**.

`.env` is git-ignored: never commit the secret. If it leaks, click **Reset Secret** again and update `.env`. You don't need a bot, a bot token or any OAuth2 URL generator; the app asks only for the `identify` and `email` scopes.

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
| `pnpm --filter @pixel-packs/client e2e` | Playwright: auth flow + style-guide screenshots (starts its own server on an in-memory DB) |
| `pnpm admin <command>` | Admin CLI: grant gold/packs, reset onboarding, dev odds override (`docs/api.md`) |

## Layout

- `apps/client` — React + Vite
- `apps/server` — Fastify API under `/api`, Drizzle (migrations in `apps/server/drizzle`)
- `packages/shared` — pure game rules and Zod schemas shared by client and server
- `tools/artgen`, `tools/econ-sim`, `tools/admin` — command-line tools
