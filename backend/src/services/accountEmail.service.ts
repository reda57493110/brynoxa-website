import { waitUntil } from '@vercel/functions';
import { getSettings, isEmailEnabled } from '../models/Settings';
import { escapeHtml, sendEmail } from './email.service';
import { button, paragraphs, renderEmail, siteUrl, toPlainText } from './emailTemplate';

type AccountUser = { _id: unknown; email: string; name?: string };

function hello(user: AccountUser) {
  const first = (user.name || '').trim().split(/\s+/)[0];
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Hi ${escapeHtml(first || 'there')},</p>`;
}

function build(heading: string, preheader: string, body: string) {
  const html = renderEmail({ heading, preheader, body });
  return { html, text: toPlainText(html) };
}

export function verificationEmail(user: AccountUser, link: string) {
  return {
    subject: 'Verify your email — Brynoxa',
    ...build(
      'Verify your email address',
      'Confirm your email to finish setting up your Brynoxa account.',
      [
        hello(user),
        paragraphs('Welcome to Brynoxa! Confirm your email address to finish setting up your account and follow your orders.'),
        button('Verify my email', link),
        paragraphs('This link expires in one hour. If you did not create a Brynoxa account, you can ignore this email.'),
      ].join('')
    ),
  };
}

export function passwordResetEmail(user: AccountUser, link: string) {
  return {
    subject: 'Reset your password — Brynoxa',
    ...build(
      'Reset your password',
      'Use this link to choose a new Brynoxa password.',
      [
        hello(user),
        paragraphs('We received a request to reset the password of your Brynoxa account.'),
        button('Choose a new password', link),
        paragraphs('This link expires in one hour and can be used once. If you did not ask for it, ignore this email — your password stays the same.'),
      ].join('')
    ),
  };
}

const SECURITY_COPY = {
  'password-changed': {
    subject: 'Your Brynoxa password was changed',
    heading: 'Your password was changed',
    line: 'The password of your Brynoxa account was just changed, and other devices were signed out.',
  },
  'password-reset': {
    subject: 'Your Brynoxa password was reset',
    heading: 'Your password was reset',
    line: 'The password of your Brynoxa account was just reset with an email link, and other devices were signed out.',
  },
  'mfa-enabled': {
    subject: 'Two-step sign-in turned on — Brynoxa',
    heading: 'Two-step sign-in is on',
    line: 'Two-step sign-in (authenticator app) was turned on for your Brynoxa account. Keep your recovery codes somewhere safe.',
  },
  'mfa-disabled': {
    subject: 'Two-step sign-in turned off — Brynoxa',
    heading: 'Two-step sign-in is off',
    line: 'Two-step sign-in was turned off for your Brynoxa account. Your account is now protected by your password only.',
  },
} as const;

export type SecurityEvent = keyof typeof SECURITY_COPY;

async function sendSecurityAlert(user: AccountUser, event: SecurityEvent) {
  if (!isEmailEnabled(await getSettings(), 'securityAlerts')) return;
  const copy = SECURITY_COPY[event];
  const when = new Date().toUTCString();
  const { html, text } = build(copy.heading, copy.line, [
    hello(user),
    paragraphs(`${copy.line}\n\nWhen: ${when}`),
    paragraphs('If this was you, there is nothing to do. If it was not you, reset your password right away and contact us on WhatsApp.'),
    button('Reset my password', siteUrl('/forgot-password')),
  ].join(''));
  await sendEmail({
    to: user.email,
    subject: copy.subject,
    html,
    text,
    idempotencyKey: `security/${String(user._id)}/${event}/${Math.floor(Date.now() / 60_000)}`,
  });
}

/** Fire-and-forget security alert; never blocks or fails the account action itself. */
export function notifySecurityEvent(user: AccountUser, event: SecurityEvent) {
  if (!user.email) return;
  waitUntil(
    sendSecurityAlert(user, event).catch((error) => {
      console.error(`Security email (${event}) failed`, error);
    })
  );
}
