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
