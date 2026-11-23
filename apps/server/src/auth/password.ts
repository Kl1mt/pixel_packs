import { hash, verify, type Options } from '@node-rs/argon2';

/** argon2id with the OWASP baseline (19 MiB, t=2, p=1), GDD §22. */
// The library's default algorithm is argon2id (asserted in the auth tests).
const OPTIONS: Options = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

let dummyHash: Promise<string> | undefined;

/**
 * Verifies a password. With no stored hash (unknown email, OAuth-only account) it
 * still runs one verification so response times don't reveal which emails exist.
 */
export async function verifyPassword(
  storedHash: string | null,
  password: string,
): Promise<boolean> {
  if (storedHash === null) {
    dummyHash ??= hashPassword('not-a-real-password');
    await verify(await dummyHash, password);
    return false;
  }
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}
