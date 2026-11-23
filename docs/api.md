# API

REST under `/api`. Bodies are JSON and validated with the Zod schemas in `packages/shared/src/api`.
Errors are always `{ "error": { "code": ApiErrorCode, "message": string } }`.

## Conventions
- **Session**: `pp_session` cookie (httpOnly, SameSite=Lax, 30 days, `Secure` when `COOKIE_SECURE`).
- **CSRF**: every `POST`/`PUT`/`PATCH`/`DELETE` must send the `x-csrf-token` header equal to the `pp_csrf` cookie. Get both from `GET /api/auth/csrf` once per page load. Missing or wrong → `403 csrf`.
- **Rate limits** are per IP; over the limit → `429 rateLimited`.
- Don't send `content-type: application/json` on body-less POSTs (Fastify rejects an empty JSON body).

## Auth (T08)
| Method & path | Body | Success | Errors | Limit |
|---|---|---|---|---|
| `GET /api/auth/csrf` | — | `200 { csrfToken }`, sets `pp_csrf` | — | — |
| `POST /api/auth/register` | `{ email, username, password }` | `201 { user }`, logs in, mails a verification link | `400 badRequest`, `409 emailTaken` / `usernameTaken` | 5 / 10 min |
| `POST /api/auth/login` | `{ email, password }` | `200 { user }`, sets the session | `401 invalidCredentials` | 10 / min |
| `POST /api/auth/logout` | — | `204`, deletes the session | — | — |
| `GET /api/auth/me` | — | `200 { user }` | `401 unauthorized` | — |
| `POST /api/auth/verify-email` | `{ token }` | `204` | `400 invalidToken` | 20 / 15 min |
| `POST /api/auth/resend-verification` | — (logged in) | `204` (no-op if verified) | `401` | 5 / 15 min |
| `POST /api/auth/password-reset/request` | `{ email }` | `202` always | — | 5 / 15 min |
| `POST /api/auth/password-reset/confirm` | `{ token, password }` | `204`, logs out every session, verifies the email | `400 invalidToken` | 20 / 15 min |

`user` is `PublicUser`: `{ id, email, username, emailVerified, onboardingStep, createdAt }`.
Rules: username 3–20 of `A–Z a–z 0–9 _`, not on the blocklist; password 10–128 characters; email and username are unique ignoring case.
Email links point at the client: `${APP_ORIGIN}/verify-email?token=…` (valid 24 h) and `${APP_ORIGIN}/reset-password?token=…` (1 h); tokens are single-use. In dev the mails are printed to the server console.

### curl
```sh
B=http://localhost:3001/api/auth; J=cookies.txt
T=$(curl -s -c $J -b $J $B/csrf | sed 's/.*"csrfToken":"\([^"]*\)".*/\1/')
curl -s -c $J -b $J -H "x-csrf-token: $T" -H 'content-type: application/json' \
  -d '{"email":"pip@example.com","username":"pip","password":"correct horse battery"}' $B/register
curl -s -b $J $B/me
curl -s -c $J -b $J -H "x-csrf-token: $T" -X POST $B/logout
```

## Discord login (T09)
Off unless `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` are set (README → "Discord login"). When off, the `discord/*` routes answer `404 notFound` and the client hides every Discord button.

| Method & path | Body / query | Success | Errors | Limit |
|---|---|---|---|---|
| `GET /api/auth/providers` | — | `200 { discord: boolean }` | — | — |
| `GET /api/auth/discord/start` | `?mode=login\|link` (full-page navigation) | `302` to Discord, sets the `pp_oauth` state cookie (httpOnly, 10 min, path `/api/auth/discord`) | `404`; `mode=link` while logged out → `302 /login?oauth=loginRequired` | 20 / 15 min |
| `GET /api/auth/discord/callback` | `?code&state` (from Discord) | `302 /` with a session (login/sign-up), or `302 /settings?discord=linked\|taken` (link) | `302 /login?oauth=denied\|failed\|noEmail\|emailExists` | 20 / 15 min |
| `GET /api/auth/linked` | — (logged in) | `200 { hasPassword, discord: { username } \| null }` | `401` | — |
| `POST /api/auth/discord/unlink` | — (logged in) | `204` | `409 lastLoginMethod` (no password set) | 20 / 15 min |

Login rules (GDD §29): a Discord id already linked logs into its account. Otherwise, if Discord's email matches an account, they are linked only when **both** emails are verified; else `emailExists` (log in with the password, then link in Settings). Otherwise a new account is created: username from the Discord handle (`A–Z a–z 0–9 _`, a `_1234` tag on collisions), no password (set one with "Forgot password"), email verified if Discord says so — else a verification mail is sent. Outcome codes are `OAuthOutcome` in `packages/shared/src/api/auth.ts`.

## Economy & packs (T10)
All routes except the odds need a session (`401 unauthorized`). Schemas: `packages/shared/src/api/economy.ts`. Mutations are limited to 60 / min per IP.

| Method & path | Body / query | Success | Errors |
|---|---|---|---|
| `GET /api/packs/odds` | — (public) | `200 { packs: PackOdds[] }`: price, enabled, rarity/variant chances in %, own-realm share, pity rules | — |
| `GET /api/economy` | — | `200 EconomyState` | — |
| `POST /api/rewards/free-pack` | `{ realm }` | `200 EconomyState`, +1 `realm:<realm>` pack | `409 notReady`, `400 packDisabled` |
| `POST /api/rewards/calendar` | — | `200 EconomyState` | `409 alreadyClaimed` |
| `POST /api/packs/buy` | `{ packTypeId, quantity? (1–10), idempotencyKey }` | `200 EconomyState` (a repeated key changes nothing) | `409 insufficientFunds` / `idempotencyConflict`, `400 packDisabled` |
| `POST /api/packs/open` | `{ packTypeId, idempotencyKey }` | `201 { opening, replayed: false }`; a repeated key → `200 { opening, replayed: true }` | `409 noPacks` / `idempotencyConflict`, `400 packDisabled` |
| `GET /api/packs/openings/pending` | — | `200 { opening \| null }` (latest unrevealed) | — |
| `POST /api/packs/openings/:id/revealed` | — | `204` (idempotent) | `404 notFound` |
| `GET /api/packs/history` | `?limit=1–50&cursor=&packTypeId=&minRarity=&variant=` (filters T15) | `200 { openings, nextCursor }`, revealed openings, newest first; `minRarity` keeps openings with a card of that rarity or better, `variant` those with a copy of that variant | `400 badRequest` (cursor, bad filter) |
| `GET /api/cards` (T15) | — | `200 { copies }`: every live copy, oldest first; each is `{ userCardId, cardId, variant, stars, edition, mintNumber, source, acquiredAt, tradeLockUntil, accountBound }` (`CollectionResponseSchema`, `api/collection.ts`) | — |
| `POST /api/cards/dust` | `{ userCardIds: uuid[] (1–200) }` | `200 { dusted, dust, wallet }`, all or nothing | `404 notFound`, `400 cannotDust` (account-bound) |
| `GET /api/cards/dust-extras` | — | `200 { copies, dust }`: what "Dust extras" would dust | — |
| `POST /api/cards/dust-extras` | — | `200 { dusted, dust, wallet }` | — |

- `packTypeId` is `realm:<realm>` or `mythic`. `idempotencyKey` is 8–64 of `A–Z a–z 0–9 _ -`; use `crypto.randomUUID()` per click and reuse it on retry.
- `EconomyState` = `{ wallet { gold, dust, gems }, packs [{ packTypeId, count }], freePack { stored, max, nextAt }, calendar { day 1–7, claimedToday, nextResetAt, rewards[7] }, pity [{ group, packsSinceLegendaryPlus, packsSinceMythic, legendaryHardPity, mythicSoftPityStart, mythicHardPity }], pendingOpeningId }`.
- `opening` = `{ id, packTypeId, scripted, pityTrigger, cards[5] (slot order), revealOrder [slots], createdAt, revealedAt }`; each card is `{ slot, featured, cardId, realm, rarity, variant, userCardId, mintNumber, edition, isNew }`. The result is stored before the response, so the client animates a finished roll; on load, `pendingOpeningId` / `openings/pending` drives "Resume reveal", and the client posts `revealed` when the reveal ends.
- A new account gets a starter satchel (one Mossgrove and one Starhollow pack) and one free pack ready. Its first two realm-pack openings are the scripted onboarding packs (`scripted: true`, no pity).
- Every change writes `ledger` rows (`reason`: `starterSatchel`, `freePack`, `calendar`, `buyPack`, `openPack`, `pull`, `dust`, `dustExtras`, `admin:grant`).

### Admin CLI (`tools/admin`)
```sh
pnpm admin grant <email|username> <gold|dust|gems> <amount> [note]
pnpm admin grant-packs <user> <realm:mossgrove|mythic|…> <count> [note]
pnpm admin reset-onboarding <user>
pnpm admin odds-override <user> <packs> [rarity] [variant]   # dev only, packs 0 clears
```
It uses `DATABASE_URL`, or else the server's PGlite directory (`PGLITE_DIR`, default `apps/server/.data/pglite`), which only one process can open: stop `pnpm dev` first. Odds overrides act like a scripted pack (no pity) and are ignored by a server with `NODE_ENV=production`.

### curl (after logging in as above)
```sh
B=http://localhost:3001/api
curl -s -b $J $B/economy
curl -s -c $J -b $J -H "x-csrf-token: $T" -H 'content-type: application/json' \
  -d '{"packTypeId":"realm:mossgrove","idempotencyKey":"my-first-pack-1"}' $B/packs/open
curl -s -c $J -b $J -H "x-csrf-token: $T" -X POST $B/rewards/calendar
```
