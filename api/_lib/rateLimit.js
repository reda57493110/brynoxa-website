const { connectMongo } = require('./mongo');
const { sendJson } = require('./http');

/**
 * Rate limits for the serverless handlers. Serverless instances share no memory, so counts live
 * in MongoDB (collection `rate_limits`, one small document per visitor + action + time window,
 * removed automatically by a TTL index). If the database check fails, the request is let through:
 * a limiter problem must never block real customers.
 */

const LIMITS = {
  // Sign-in and account
  login: { max: 20, windowMs: 15 * 60 * 1000, message: 'Too many sign-in attempts. Please wait a few minutes and try again.' },
  mfa: { max: 20, windowMs: 15 * 60 * 1000, message: 'Too many attempts. Please wait a few minutes and try again.' },
  // One 2-step sign-in (one challenge): a handful of code tries, then sign in again
  mfaChallenge: { max: 5, windowMs: 10 * 60 * 1000, message: 'Too many wrong codes. Please sign in again.' },
  register: { max: 10, windowMs: 60 * 60 * 1000, message: 'Too many sign-ups from this connection. Please try again later.' },
  // Emails sent to someone: kept low so nobody can flood an inbox or use up the email quota
  emailSend: { max: 5, windowMs: 15 * 60 * 1000, message: 'Too many emails requested. Please wait a few minutes and try again.' },
  emailLink: { max: 20, windowMs: 15 * 60 * 1000, message: 'Too many attempts. Please wait a few minutes and try again.' },
  // Shop. Generous: many customers in Morocco share one mobile IP address.
  order: { max: 20, windowMs: 60 * 60 * 1000, message: 'Too many orders from this connection. Please wait a little or contact us on WhatsApp.' },
  // Same email or phone, from any connection (stops order / email floods aimed at one person)
  orderPerCustomer: { max: 8, windowMs: 60 * 60 * 1000, message: 'Too many orders for this email or phone. Please wait a little or contact us on WhatsApp.' },
  track: { max: 30, windowMs: 15 * 60 * 1000, message: 'Too many tracking attempts. Please wait a few minutes and try again.' },
  coupon: { max: 30, windowMs: 15 * 60 * 1000, message: 'Too many coupon attempts. Please wait a few minutes and try again.' },
  depositReport: { max: 20, windowMs: 60 * 60 * 1000, message: 'Too many attempts. Please wait a little and try again.' },
  contact: { max: 10, windowMs: 60 * 60 * 1000, message: 'Too many messages. Please try again later.' },
  pushSubscribe: { max: 60, windowMs: 60 * 60 * 1000, message: 'Too many requests. Please try again later.' },
  pushClick: { max: 120, windowMs: 15 * 60 * 1000, message: 'Too many requests.' },
};

let indexReady = null;

function clientIp(req) {
  // Vercel sets x-forwarded-for; the first address is the visitor
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req.headers['x-real-ip'] || '') || req.socket?.remoteAddress || 'unknown';
}

async function hit(key, windowMs) {
  const conn = await connectMongo();
  const col = conn.db.collection('rate_limits');
  if (!indexReady) {
    indexReady = col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch((err) => {
      indexReady = null;
      throw err;
    });
  }
  await indexReady;
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const doc = await col.findOneAndUpdate(
    { _id: `${key}:${windowStart}` },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowStart + windowMs) } },
    { upsert: true, returnDocument: 'after' }
  );
  // Driver v6 returns the document; older versions wrap it in { value }
  const value = doc && typeof doc.count === 'number' ? doc : doc?.value;
  return { count: value?.count ?? 1, retryAfter: Math.ceil((windowStart + windowMs - Date.now()) / 1000) };
}

/**
 * Counts this request against `name` for the visitor's IP (plus an optional extra key, e.g. an
 * email). Sends 429 and returns false when over the limit; returns true otherwise.
 */
async function rateLimit(req, res, name, extraKey, { perIp = true } = {}) {
  const rule = LIMITS[name];
  if (!rule) return true;
  try {
    const keys = perIp ? [`${name}:ip:${clientIp(req)}`] : [];
    if (extraKey) keys.push(`${name}:k:${String(extraKey).trim().toLowerCase().slice(0, 200)}`);
    const results = await Promise.all(keys.map((k) => hit(k, rule.windowMs)));
    const over = results.find((r) => r.count > rule.max);
    if (over) {
      res.setHeader('Retry-After', String(Math.max(1, over.retryAfter)));
      sendJson(res, 429, { success: false, message: rule.message });
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Rate limit check skipped:', err && err.message);
    return true;
  }
}

module.exports = { rateLimit, clientIp, LIMITS };
