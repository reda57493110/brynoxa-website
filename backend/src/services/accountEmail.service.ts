import { waitUntil } from '@vercel/functions';
import { getSettings, isEmailEnabled } from '../models/Settings';
import { escapeHtml, sendEmail } from './email.service';
import { button, paragraphs, renderEmail, siteUrl, toPlainText } from './emailTemplate';

type AccountUser = { _id: unknown; email: string; name?: string };

function hello(user: AccountUser) {
  const first = (user.name || '').trim().split(/\s+/)[0];
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Hi ${escapeHtml(first || 'there')},</p>`;
}

/** The 6-digit reset code, large and spaced so it is easy to read and type. */
function codeBox(code: string) {
  return `<p style="margin:18px 0 6px;font-size:13px;color:#5b6472;">Your code</p>
<p style="margin:0 0 6px;font-size:32px;font-weight:800;letter-spacing:8px;font-family:Consolas,Menlo,monospace;color:#0b1220;">${escapeHtml(code)}</p>`;
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

/** A guest customer (ordered without an account) choosing a password: proves they own the email. */
export function accountClaimEmail(user: AccountUser, link: string, code?: string) {
  return {
    subject: 'Finish creating your account — Brynoxa',
    ...build(
      'Finish creating your account',
      'Choose a password to see your Brynoxa orders.',
      [
        hello(user),
        paragraphs('Someone asked to create a Brynoxa account with this email. You already ordered with us, so choose a password to open your account and follow your orders.'),
        code ? codeBox(code) : '',
        code ? paragraphs('Type this code on the Brynoxa page that asked for it (valid 15 minutes), or use the button:') : '',
        button('Choose my password', link),
        paragraphs('This link expires in one hour and can be used once. If you did not ask for it, ignore this email — nothing changes.'),
      ].join('')
    ),
  };
}

export function passwordResetEmail(user: AccountUser, link: string, code?: string) {
  return {
    subject: 'Reset your password — Brynoxa',
    ...build(
      'Reset your password',
      'Use this link to choose a new Brynoxa password.',
      [
        hello(user),
        paragraphs('We received a request to reset the password of your Brynoxa account.'),
        code ? codeBox(code) : '',
        code ? paragraphs('Type this code on the Brynoxa "Reset password" page (valid 15 minutes). Or use the button:') : '',
        button('Choose a new password', link),
        paragraphs('The code and the link work once. The link expires in one hour. If you did not ask for this, ignore this email — your password stays the same. Never share this code: Brynoxa will never ask you for it.'),
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
    line: 'The password of your Brynoxa account was just reset with an email code or link, and other devices were signed out.',
  },
  'mfa-enabled': {
    subject: 'Two-step sign-in turned on — Brynoxa',
    heading: 'Two-step sign-in is on',
    line: 'Two-step sign-in (authenticator app) was turned on for your Brynoxa account. Keep the authenticator app on your phone: its code is the only way to sign in.',
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
