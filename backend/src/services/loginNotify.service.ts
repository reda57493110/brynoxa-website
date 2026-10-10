import { waitUntil } from '@vercel/functions';
import { env } from '../config/env';
import { sendEmail } from './email.service';
import { button, detailRows, paragraphs, renderEmail, siteUrl, toPlainText } from './emailTemplate';

export type LoginRequestMeta = {
  ip?: string;
  userAgent?: string;
};

type StaffLoginUser = {
  name?: string;
  email?: string;
  role?: string;
  phone?: string;
};

/** Always emailed on every staff admin login. */
const STAFF_LOGIN_NOTIFY_EMAIL = 'reda.lazrak2004@gmail.com';

function summarizeUserAgent(ua?: string) {
  if (!ua?.trim()) return 'Unknown device';
  const value = ua.trim();
  if (value.length <= 160) return value;
  return `${value.slice(0, 157)}...`;
}

async function sendStaffLoginEmail(user: StaffLoginUser, meta: LoginRequestMeta) {
  const recipients = Array.from(
    new Set(
      [STAFF_LOGIN_NOTIFY_EMAIL, env.ADMIN_EMAIL?.toLowerCase()].filter(Boolean) as string[]
    )
  );

  const when = new Date().toLocaleString('en-GB', {
    timeZone: 'Africa/Casablanca',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const rows: Array<[string, string]> = [
    ['Name', user.name || '—'],
    ['Email', user.email || '—'],
    ['Role', user.role || '—'],
    ['Phone', user.phone || 'Not set on account'],
    ['IP address', meta.ip || 'Unknown'],
    ['Device / browser', summarizeUserAgent(meta.userAgent)],
    ['Time (Morocco)', when],
  ];

  const html = renderEmail({
    heading: 'Staff signed in to admin',
    preheader: `${user.name || user.email || 'Staff'} signed in to the Brynoxa admin panel.`,
    body: [
      paragraphs('Someone signed in to the Brynoxa admin panel.'),
      detailRows(rows.map(([label, value]) => ({ label, value }))),
      paragraphs('If this was not you or your team, change the account password and review two-step sign-in right away.'),
      button('Open security settings', siteUrl('/admin/security')),
    ].join(''),
  });

  await sendEmail({
    to: recipients,
    subject: `Admin login: ${user.name || user.email || 'staff'} (${user.role || 'staff'})`,
    html,
    text: toPlainText(html),
  });
}

/**
 * Schedule a staff-login email after the HTTP response.
 * Never blocks or fails sign-in (no external geo lookups).
 */
export function notifyAdminStaffLogin(user: StaffLoginUser, meta: LoginRequestMeta = {}) {
  // waitUntil keeps the serverless function alive until the email is sent
  waitUntil(
    sendStaffLoginEmail(user, meta).catch((err) => {
      console.error('Staff login email failed:', err);
    })
  );
}
