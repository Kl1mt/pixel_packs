import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** 32 random bytes as base64url (43 chars): session, CSRF and email tokens. */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Tokens are stored only as their SHA-256, so a database leak reveals no live token. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
