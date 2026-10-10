import { Resend } from 'resend';
import { env, isEmailConfigured } from '../config/env';

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [600, 2000];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Temporary failures worth retrying: network errors, rate limits, Resend 5xx. */
function isRetryable(error: { name?: string; statusCode?: number | null } | null | undefined) {
  if (!error) return false;
  const status = error.statusCode ?? 0;
  return status === 429 || status >= 500 || error.name === 'rate_limit_exceeded' || error.name === 'application_error';
}

/** Masks the local part so logs never contain full customer addresses. */
function maskEmail(to: string | string[]) {
  return (Array.isArray(to) ? to : [to])
    .map((addr) => addr.replace(/^(.).*(@.*)$/, '$1***$2'))
    .join(', ');
}

/**
 * Sends a transactional email through Resend (server-side only — the API key never reaches the browser).
 * Retries temporary failures; `idempotencyKey` makes Resend drop repeats of the same event for 24 h,
 * so retries, double clicks or concurrent requests never send the same email twice.
 * Never throws: returns false and logs when the email could not be sent.
 */
export async function sendEmail(input: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  idempotencyKey?: string;
  replyTo?: string;
}): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn(`[email] skipped, Resend not configured: "${input.subject}"`);
    return false;
  }

  const resend = new Resend(env.RESEND_API_KEY!);
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { error } = await resend.emails.send(
        {
          from: env.EMAIL_FROM!,
          to: input.to,
          subject: input.subject,
          html: input.html,
          text: input.text,
          replyTo: input.replyTo,
        },
        input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined
      );
      if (!error) return true;
      if (!isRetryable(error) || attempt === MAX_ATTEMPTS) {
        console.error(`[email] failed "${input.subject}" to ${maskEmail(input.to)}:`, error);
        return false;
      }
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) {
        console.error(`[email] failed "${input.subject}" to ${maskEmail(input.to)}:`, err);
        return false;
      }
    }
    await wait(RETRY_DELAYS_MS[attempt - 1] ?? 2000);
  }
  return false;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
