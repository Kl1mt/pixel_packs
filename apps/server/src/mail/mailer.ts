export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Mail transport. Dev uses the console; production needs SMTP (GDD §22, §27). */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** Prints emails to stdout so links can be clicked from the dev terminal. */
export function createConsoleMailer(
  write: (s: string) => void = (s) => process.stdout.write(s),
): Mailer {
  return {
    send(message) {
      const line = '-'.repeat(60);
      write(
        `\n${line}\nMail to: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n${line}\n`,
      );
      return Promise.resolve();
    },
  };
}

/** Collects emails in memory (tests). */
export function createMemoryMailer(): Mailer & { sent: MailMessage[] } {
  const sent: MailMessage[] = [];
  return {
    sent,
    send(message) {
      sent.push(message);
      return Promise.resolve();
    },
  };
}
