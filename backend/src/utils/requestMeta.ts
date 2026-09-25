import type { Request } from 'express';

/** Best-effort client IP behind Vercel / proxies. */
export function getClientIp(req: {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string;
  socket?: { remoteAddress?: string };
}): string | undefined {
  const headers = req.headers || {};
  const forwarded = headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).split(',')[0]?.trim();
  }
  const realIp = headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();
  if (req.ip && req.ip !== '::ffff:127.0.0.1') return req.ip.replace(/^::ffff:/, '');
  const remote = req.socket?.remoteAddress;
  return remote ? remote.replace(/^::ffff:/, '') : undefined;
}

export function getUserAgent(req: {
  headers?: Record<string, string | string[] | undefined>;
}): string | undefined {
  const ua = req.headers?.['user-agent'];
  if (typeof ua === 'string' && ua.trim()) return ua.trim();
  if (Array.isArray(ua) && ua[0]) return String(ua[0]).trim();
  return undefined;
}

export function getRequestMeta(req: Request | { headers?: Record<string, string | string[] | undefined>; ip?: string; socket?: { remoteAddress?: string } }) {
  return {
    ip: getClientIp(req),
    userAgent: getUserAgent(req),
  };
}
