import { OAuthOutcomeSchema, type ApiErrorCode, type OAuthOutcome } from '@pixel-packs/shared';

/** Warm, short copy for the Discord callback outcomes (`?oauth=` / `?discord=`). */
export const OAUTH_MESSAGES: Record<OAuthOutcome, string> = {
  denied: 'Discord login was cancelled. No harm done.',
  failed: 'Discord login didn’t work out. Please try again.',
  noEmail: 'Your Discord account has no email address. Add one on Discord, or sign up with email.',
  emailExists:
    'There’s already an account with that email. Log in with your password, then link Discord in Settings.',
  loginRequired: 'Please log in first.',
  linked: 'Discord is linked. You can now log in with it.',
  taken: 'That Discord account already belongs to another player.',
};

/** The message for a query parameter value, or null if it isn't a known outcome. */
export function oauthMessage(value: string | null): { outcome: OAuthOutcome; text: string } | null {
  const parsed = OAuthOutcomeSchema.safeParse(value);
  return parsed.success ? { outcome: parsed.data, text: OAUTH_MESSAGES[parsed.data] } : null;
}

/** Only same-site paths are allowed as `?next=` targets (no `//evil.example`). */
export function safeNext(next: string | null): string {
  return next !== null && /^\/(?![/\\])/.test(next) ? next : '/';
}

/** Server error codes that belong to one form field. */
export const FIELD_FOR_CODE: Partial<Record<ApiErrorCode, 'email' | 'username' | 'password'>> = {
  emailTaken: 'email',
  usernameTaken: 'username',
};
