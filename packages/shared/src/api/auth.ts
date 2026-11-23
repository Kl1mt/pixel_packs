import { z } from 'zod';
import { isUsernameBlocked } from './usernameBlocklist.js';

/** Header that carries the CSRF token on every mutation (double-submit, GDD §22). */
export const CSRF_HEADER = 'x-csrf-token';
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export const EmailSchema = z.string().trim().max(254).pipe(z.email());

/** 3–20 letters, digits or underscores, filtered against the blocklist (GDD §22). */
export const UsernameSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_]{3,20}$/, 'Use 3–20 letters, digits or underscores.')
  .refine((name) => !isUsernameBlocked(name), 'That username is not available.');

export const PasswordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);

export const RegisterRequestSchema = z.object({
  email: EmailSchema,
  username: UsernameSchema,
  password: PasswordSchema,
});
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

/** Login checks the password only, so the length limits are loose here. */
export const LoginRequestSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const EmailTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const VerifyEmailRequestSchema = z.object({ token: EmailTokenSchema });
export type VerifyEmailRequest = z.infer<typeof VerifyEmailRequestSchema>;

export const PasswordResetRequestSchema = z.object({ email: EmailSchema });
export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;

export const PasswordResetConfirmSchema = z.object({
  token: EmailTokenSchema,
  password: PasswordSchema,
});
export type PasswordResetConfirm = z.infer<typeof PasswordResetConfirmSchema>;

export const PublicUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  username: z.string(),
  emailVerified: z.boolean(),
  onboardingStep: z.int().min(0),
  createdAt: z.iso.datetime(),
});
export type PublicUser = z.infer<typeof PublicUserSchema>;

export const UserResponseSchema = z.object({ user: PublicUserSchema });
export type UserResponse = z.infer<typeof UserResponseSchema>;

export const CsrfResponseSchema = z.object({ csrfToken: z.string().min(1) });
export type CsrfResponse = z.infer<typeof CsrfResponseSchema>;

export const ApiErrorCodeSchema = z.enum([
  'badRequest',
  'unauthorized',
  'invalidCredentials',
  'csrf',
  'emailTaken',
  'usernameTaken',
  'invalidToken',
  'rateLimited',
  'notFound',
  'internal',
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({ code: ApiErrorCodeSchema, message: z.string() }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
