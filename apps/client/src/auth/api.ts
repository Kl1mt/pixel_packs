import {
  AuthProvidersResponseSchema,
  LinkedAccountsResponseSchema,
  UserResponseSchema,
  type AuthProvidersResponse,
  type LinkedAccountsResponse,
  type LoginRequest,
  type PublicUser,
  type RegisterRequest,
} from '@pixel-packs/shared';
import { ApiError, http as defaultHttp, type Http } from '../http.js';

/** Auth endpoints (docs/api.md), validated with the shared Zod schemas. */
export function createAuthApi(http: Http = defaultHttp) {
  const user = async (p: Promise<{ user: PublicUser } | undefined>) => {
    const res = await p;
    if (res === undefined) throw new ApiError(500, 'internal', 'Empty answer from the server.');
    return res.user;
  };
  return {
    /** The logged-in user, or null when there is no session. */
    async me(): Promise<PublicUser | null> {
      try {
        return (await http.get('/api/auth/me', UserResponseSchema)).user;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    login: (input: LoginRequest) => user(http.post('/api/auth/login', input, UserResponseSchema)),
    register: (input: RegisterRequest) =>
      user(http.post('/api/auth/register', input, UserResponseSchema)),
    logout: () => http.post('/api/auth/logout'),
    verifyEmail: (token: string) => http.post('/api/auth/verify-email', { token }),
    resendVerification: () => http.post('/api/auth/resend-verification'),
    requestReset: (email: string) => http.post('/api/auth/password-reset/request', { email }),
    confirmReset: (token: string, password: string) =>
      http.post('/api/auth/password-reset/confirm', { token, password }),
    providers: (): Promise<AuthProvidersResponse> =>
      http.get('/api/auth/providers', AuthProvidersResponseSchema),
    linked: (): Promise<LinkedAccountsResponse> =>
      http.get('/api/auth/linked', LinkedAccountsResponseSchema),
    unlinkDiscord: () => http.post('/api/auth/discord/unlink'),
  };
}

export type AuthApi = ReturnType<typeof createAuthApi>;
export const authApi = createAuthApi();

/** Full-page navigations to start Discord OAuth (the server redirects to Discord). */
export const discordStartUrl = (mode: 'login' | 'link') => `/api/auth/discord/start?mode=${mode}`;
