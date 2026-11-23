import { describe, expect, it } from 'vitest';
import { RegisterRequestSchema, UsernameSchema } from './auth.js';
import { isUsernameBlocked } from './usernameBlocklist.js';

describe('UsernameSchema', () => {
  it('accepts plain names and trims them', () => {
    expect(UsernameSchema.parse('  Moss_Fan42 ')).toBe('Moss_Fan42');
  });

  it.each(['ab', 'a'.repeat(21), 'has space', 'émile', 'dash-name'])('rejects %j', (name) => {
    expect(UsernameSchema.safeParse(name).success).toBe(false);
  });

  it('blocks reserved and offensive names, including leetspeak and underscores', () => {
    for (const name of [
      'Admin',
      'the_admin_2',
      'Support',
      'St4ff',
      'PixelPacks_Team',
      'sh1t_lord',
      'f_u_c_k',
    ]) {
      expect(isUsernameBlocked(name)).toBe(true);
    }
    for (const name of ['Mossgrove', 'StarFan', 'Pip_the_Otter', 'Rootbeer', 'Supporter']) {
      expect(isUsernameBlocked(name)).toBe(false);
    }
  });
});

describe('RegisterRequestSchema', () => {
  it('validates email and password length', () => {
    const ok = { email: ' pip@example.com ', username: 'pip', password: 'longenough1' };
    expect(RegisterRequestSchema.parse(ok).email).toBe('pip@example.com');
    expect(RegisterRequestSchema.safeParse({ ...ok, email: 'nope' }).success).toBe(false);
    expect(RegisterRequestSchema.safeParse({ ...ok, password: 'short' }).success).toBe(false);
  });
});
