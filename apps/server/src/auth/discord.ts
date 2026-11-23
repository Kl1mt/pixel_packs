import { z } from 'zod';
import { UsernameSchema } from '@pixel-packs/shared';

/** What we keep from a Discord login (scopes `identify email`). */
export interface DiscordIdentity {
  id: string;
  /** Unique Discord handle, e.g. `mossy.fox`. */
  username: string;
  /** Display name (`global_name`), falling back to the handle. */
  displayName: string;
  email: string | null;
  emailVerified: boolean;
}

/** The two OAuth steps, behind an interface so tests can use a fake Discord. */
export interface DiscordClient {
  authorizeUrl(state: string): string;
  /** Trades the callback `code` for the user's identity. Throws on any failure. */
  exchange(code: string): Promise<DiscordIdentity>;
}

export interface DiscordConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

const API = 'https://discord.com/api/v10';
const AUTHORIZE = 'https://discord.com/oauth2/authorize';

const TokenSchema = z.object({ access_token: z.string().min(1), token_type: z.string() });
const MeSchema = z.object({
  id: z.string().regex(/^\d{1,25}$/),
  username: z.string().min(1),
  global_name: z.string().nullish(),
  email: z.string().nullish(),
  verified: z.boolean().nullish(),
});

export function createDiscordClient(
  cfg: DiscordConfig,
  fetchFn: typeof fetch = fetch,
): DiscordClient {
  return {
    authorizeUrl(state) {
      const q = new URLSearchParams({
        response_type: 'code',
        client_id: cfg.clientId,
        scope: 'identify email',
        redirect_uri: cfg.redirectUri,
        state,
        prompt: 'none',
      });
      return `${AUTHORIZE}?${q.toString()}`;
    },

    async exchange(code) {
      const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
      const tokenRes = await fetchFn(`${API}/oauth2/token`, {
        method: 'POST',
        headers: {
          authorization: `Basic ${basic}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: cfg.redirectUri,
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!tokenRes.ok) throw new Error(`Discord token exchange failed: HTTP ${tokenRes.status}`);
      const token = TokenSchema.parse(await tokenRes.json());

      const meRes = await fetchFn(`${API}/users/@me`, {
        headers: { authorization: `${token.token_type} ${token.access_token}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!meRes.ok) throw new Error(`Discord /users/@me failed: HTTP ${meRes.status}`);
      const me = MeSchema.parse(await meRes.json());
      const email = me.email ? me.email.trim() : null;
      return {
        id: me.id,
        username: me.username,
        displayName: me.global_name?.trim() || me.username,
        email: email && email.length > 0 ? email : null,
        emailVerified: me.verified === true,
      };
    },
  };
}

/**
 * A valid Pixel Packs username made from a Discord handle (GDD §22 rules): keeps
 * `A–Z a–z 0–9 _`, pads short names, and falls back to `critter` if the result is blocked.
 */
export function usernameBaseFromDiscord(handle: string): string {
  let base = handle.replace(/[^A-Za-z0-9_]/g, '').slice(0, 20);
  if (base.length < 3) base = `${base}_pal`.replace(/^_/, '');
  return UsernameSchema.safeParse(base).success ? base : 'critter';
}

/** Username candidates: the base first, then the base with a random 4-digit tag. */
export function usernameCandidate(base: string, attempt: number, rand: () => number): string {
  if (attempt === 0) return base;
  const tag = String(Math.floor(rand() * 10_000)).padStart(4, '0');
  return `${base.slice(0, 15)}_${tag}`;
}
