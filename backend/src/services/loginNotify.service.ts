import { env } from '../config/env';
import { getSettings } from '../models/Settings';
import { escapeHtml, sendEmail } from './email.service';

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

function wrapEmail(title: string, body: string) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f7f9;font-family:Manrope,Segoe UI,Arial,sans-serif;color:#0c1218;">
  <div style="max-width:560px;margin:24px auto;background:#ffffff;border:1px solid #d5dde4;border-radius:16px;overflow:hidden;">
    <div style="padding:20px 24px;background:#080B0E;color:#fff;">
      <div style="font-size:18px;font-weight:700;letter-spacing:-0.02em;">Brynoxa</div>
      <div style="margin-top:4px;font-size:13px;color:#7adfff;">${escapeHtml(title)}</div>
    </div>
    <div style="padding:24px;">${body}</div>
    <div style="padding:16px 24px;border-top:1px solid #e8ecef;font-size:12px;color:#5a6a7a;">
      Security alert from your Brynoxa admin panel.
    </div>
  </div>
</body></html>`;
}

function isPrivateIp(ip: string) {
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );
}

async function lookupLocation(ip?: string): Promise<string> {
  if (!ip || isPrivateIp(ip)) return 'Unknown / local network';
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);
    if (!res.ok) return 'Unknown';
    const data = (await res.json()) as {
      success?: boolean;
      city?: string;
      region?: string;
      country?: string;
    };
    if (!data?.success) return 'Unknown';
    return [data.city, data.region, data.country].filter(Boolean).join(', ') || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

function summarizeUserAgent(ua?: string) {
  if (!ua?.trim()) return 'Unknown device';
  const value = ua.trim();
  if (value.length <= 160) return value;
  return `${value.slice(0, 157)}...`;
}

/**
 * Fire-and-forget email when a staff account signs into the admin panel.
 * Never throws to the login flow.
 */
export function notifyAdminStaffLogin(user: StaffLoginUser, meta: LoginRequestMeta = {}) {
  void (async () => {
    try {
      const settings = await getSettings();
      if (settings.notifyStaffLoginEmail === false) return;

      const to = env.ADMIN_EMAIL || settings.supportEmail;
      if (!to) {
        console.warn('Staff login email skipped: no ADMIN_EMAIL / supportEmail');
        return;
      }

      const location = await lookupLocation(meta.ip);
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
        ['Approximate location', location],
        ['Device / browser', summarizeUserAgent(meta.userAgent)],
        ['Time (Morocco)', when],
      ];

      const table = rows
        .map(
          ([label, value]) =>
            `<tr>
              <td style="padding:8px 0;border-bottom:1px solid #e8ecef;color:#5a6a7a;width:42%;">${escapeHtml(label)}</td>
              <td style="padding:8px 0;border-bottom:1px solid #e8ecef;font-weight:600;">${escapeHtml(value)}</td>
            </tr>`
        )
        .join('');

      await sendEmail({
        to,
        subject: `Admin login: ${user.name || user.email || 'staff'} (${user.role || 'staff'})`,
        html: wrapEmail(
          'Staff signed in to admin',
          `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
            Someone signed in to the Brynoxa admin panel.
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">${table}</table>
          <p style="margin:16px 0 0;font-size:13px;color:#5a6a7a;line-height:1.5;">
            If this was not you or your team, change the account password and disable MFA recovery codes immediately.
          </p>`
        ),
      });
    } catch (err) {
      console.error('Staff login email failed:', err);
    }
  })();
}
