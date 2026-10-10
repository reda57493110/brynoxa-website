import { env } from '../config/env';
import { escapeHtml } from './email.service';

/** Store contact shown in every email footer (mirrors frontend/src/lib/site.ts). */
const STORE = {
  whatsappLabel: '07 79 31 80 61',
  whatsappUrl: 'https://wa.me/212779318061',
  email: 'brynoxa.shop@gmail.com',
};

const BRAND = '#00c2ff';
const INK = '#0c1218';
const MUTED = '#5a6a7a';
const LINE = '#e6ebef';

export function siteUrl(path = '') {
  return `${(env.CLIENT_URL || '').replace(/\/$/, '')}${path}`;
}

export function formatMad(amount: number) {
  return `${(Math.round(amount * 100) / 100).toLocaleString('en-US')} DH`;
}

/** Plain paragraph(s) from trusted-or-escaped text; blank lines become separate paragraphs. */
export function paragraphs(text: string) {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:${INK};">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`
    )
    .join('');
}

/** Label/value rows, e.g. order totals or delivery details. Values are escaped. */
export function detailRows(rows: { label: string; value: string; strong?: boolean }[]) {
  const body = rows
    .map(
      (r) => `<tr>
        <td style="padding:7px 0;font-size:14px;color:${MUTED};">${escapeHtml(r.label)}</td>
        <td style="padding:7px 0;font-size:14px;text-align:right;color:${INK};${r.strong ? 'font-weight:700;' : ''}">${escapeHtml(r.value)}</td>
      </tr>`
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${body}</table>`;
}

/** A titled, boxed block inside an email. `html` must already be safe. */
export function panel(title: string, html: string, tone: 'default' | 'highlight' = 'default') {
  const bg = tone === 'highlight' ? '#e9f9ff' : '#f6f8fa';
  const border = tone === 'highlight' ? '#a6e6fb' : LINE;
  return `<div style="margin:18px 0;padding:16px 18px;background:${bg};border:1px solid ${border};border-radius:12px;">
    <div style="margin:0 0 8px;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${MUTED};">${escapeHtml(title)}</div>
    ${html}
  </div>`;
}

export function button(label: string, url: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px;"><tr><td style="border-radius:999px;background:${BRAND};">
    <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:700;color:#041018;text-decoration:none;border-radius:999px;">${escapeHtml(label)}</a>
  </td></tr></table>`;
}

/**
 * Wraps content in the Brynoxa email layout: logo header, white card, contact footer.
 * Table-based and inline-styled so it renders in Gmail, Outlook and phone mail apps.
 */
export function renderEmail(input: { preheader: string; heading: string; body: string }) {
  const logo = siteUrl('/brand/brynoxa-mark.png');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>${escapeHtml(input.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#eef2f5;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f5;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;font-family:Manrope,'Segoe UI',Helvetica,Arial,sans-serif;">
      <tr><td style="padding:18px 24px;background:#080b0e;border-radius:16px 16px 0 0;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;"><img src="${logo}" width="36" height="36" alt="" style="display:block;border:0;border-radius:9px;" /></td>
          <td style="vertical-align:middle;padding-left:10px;font-size:20px;font-weight:800;letter-spacing:-.02em;color:#ffffff;">Bryno<span style="color:${BRAND};">xa</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:28px 24px 8px;background:#ffffff;">
        <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:800;color:${INK};">${escapeHtml(input.heading)}</h1>
        ${input.body}
      </td></tr>
      <tr><td style="padding:18px 24px 22px;background:#ffffff;border-top:1px solid ${LINE};border-radius:0 0 16px 16px;font-size:13px;line-height:1.6;color:${MUTED};">
        Questions? WhatsApp <a href="${STORE.whatsappUrl}" style="color:#0077a8;text-decoration:none;">${STORE.whatsappLabel}</a>
        · <a href="mailto:${STORE.email}" style="color:#0077a8;text-decoration:none;">${STORE.email}</a><br/>
        Brynoxa · Cash on delivery across Morocco · <a href="${siteUrl('/')}" style="color:#0077a8;text-decoration:none;">${escapeHtml(siteUrl('/').replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** Plain-text fallback from the rendered HTML (better deliverability, readable anywhere). */
export function toPlainText(html: string) {
  return html
    .replace(/<head[\s\S]*?<\/head>/i, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<div style="display:none[\s\S]*?<\/div>/i, '')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<(br|\/p|\/tr|\/h1|\/div)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}
