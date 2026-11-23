import type { MailMessage } from '../mail/mailer.js';

/** Email texts (GDD §21: UI strings live in one module; these are the server's). */
export function verificationEmail(to: string, username: string, link: string): MailMessage {
  return {
    to,
    subject: 'Confirm your Pixel Packs email',
    text: `Hi ${username}!\n\nConfirm your email address by opening this link:\n${link}\n\nThe link is valid for 24 hours. If you didn't sign up, you can ignore this email.`,
  };
}

export function passwordResetEmail(to: string, username: string, link: string): MailMessage {
  return {
    to,
    subject: 'Reset your Pixel Packs password',
    text: `Hi ${username}!\n\nSomeone asked to reset your password. Choose a new one here:\n${link}\n\nThe link is valid for 1 hour. If this wasn't you, ignore this email; your password stays the same.`,
  };
}
