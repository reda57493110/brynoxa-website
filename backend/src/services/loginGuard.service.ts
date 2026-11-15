import mongoose, { Types } from 'mongoose';

/**
 * Wrong passwords are counted per account AND per visitor (IP address). Someone who knows the
 * owner's email can only block their own connection: the owner, signing in from anywhere else,
 * is never locked out by them. A whole-account lock remains for attacks spread over many
 * addresses, at a level a single person cannot reach.
 *
 * Counts live in the `rate_limits` collection (same documents and TTL index as
 * api/_lib/rateLimit.js), so local Express and the serverless functions share them. `db` is the
 * database to use (the serverless sign-in passes its own connection).
 */
export const VISITOR_MAX_FAILURES = 5;
export const ACCOUNT_MAX_FAILURES = 100;
export const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;
/** The whole-account count covers one hour, then starts over (old failures never add up forever) */
export const ACCOUNT_WINDOW_MS = 60 * 60 * 1000;

/**
 * The visitor's network: an IPv4 address as is, an IPv6 address by its /64 block (one person
 * easily has millions of addresses in it, which must not count as millions of visitors).
 */
export function visitorNetwork(ip?: string) {
  let v = String(ip || 'unknown').trim().toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
  if (mapped) return mapped[1];
  if (!v.includes(':')) return v.slice(0, 64);
  v = v.split('%')[0];
  const [head, tail = ''] = v.split('::');
  const h = head ? head.split(':') : [];
  const t = v.includes('::') && tail ? tail.split(':') : [];
  const groups = v.includes('::') ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '') || '0').join(':')}::/64`;
}

type Db = { collection: (name: string) => any };
type Id = Types.ObjectId | string;

// No database connection (tests of other parts): no counting, like the other limits
const defaultDb = (): Db | undefined => mongoose.connection.db as unknown as Db | undefined;
const windowStart = () => Math.floor(Date.now() / LOGIN_LOCKOUT_MS) * LOGIN_LOCKOUT_MS;
const visitorKey = (userId: Id, ip?: string) =>
  `loginFail:${String(userId)}:${visitorNetwork(ip)}:${windowStart()}`;
const accountWindow = () => Math.floor(Date.now() / ACCOUNT_WINDOW_MS) * ACCOUNT_WINDOW_MS;
const accountKey = (userId: Id) => `loginFailAccount:${String(userId)}:${accountWindow()}`;

/** This visitor already gave too many wrong passwords / codes for this account. */
export async function visitorBlocked(userId: Id, ip?: string, db: Db | undefined = defaultDb()) {
  if (!db) return false;
  const doc = await db.collection('rate_limits').findOne({ _id: visitorKey(userId, ip) });
  return (doc?.count || 0) >= VISITOR_MAX_FAILURES;
}

/** The whole account is locked (many wrong attempts from many addresses). */
export function accountLocked(user: { lockedUntil?: Date | string | null } | null | undefined) {
  return Boolean(user?.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now());
}

/**
 * Whether the account lock refuses this sign-in. A lock caused by strangers must not keep the
 * owner out: with 2-step sign-in on, the right password still goes on to the code step (the code is
 * the second lock, with its own limits), so only accounts without 2-step stay fully locked.
 */
export function lockRefuses(
  user: { lockedUntil?: Date | string | null } | null | undefined,
  passwordOk: boolean,
  hasSecondFactor: boolean
) {
  return accountLocked(user) && !(passwordOk && hasSecondFactor);
}

/** Counts a wrong password / code, atomically (a burst of attempts all count). */
export async function recordLoginFailure(userId: Id, ip?: string, db: Db | undefined = defaultDb()) {
  if (!db) return;
  await db.collection('rate_limits').findOneAndUpdate(
    { _id: visitorKey(userId, ip) },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowStart() + LOGIN_LOCKOUT_MS) } },
    { upsert: true, returnDocument: 'after' }
  );
  // Whole account: failures of the last hour from everywhere (starts over each hour)
  const counted = await db.collection('rate_limits').findOneAndUpdate(
    { _id: accountKey(userId) },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(accountWindow() + ACCOUNT_WINDOW_MS) } },
    { upsert: true, returnDocument: 'after' }
  );
  // Driver v6 returns the document; older versions wrap it in { value }
  const doc = counted && typeof counted.count === 'number' ? counted : counted?.value;
  if ((doc?.count || 0) >= ACCOUNT_MAX_FAILURES) {
    await db.collection('users').updateOne({ _id: userId }, { $set: { lockedUntil: new Date(Date.now() + LOGIN_LOCKOUT_MS) } });
  }
}

/** A successful sign-in clears this visitor's count. */
export async function clearLoginFailures(userId: Id, ip?: string, db: Db | undefined = defaultDb()) {
  if (!db) return;
  await db.collection('rate_limits').updateOne({ _id: visitorKey(userId, ip) }, { $set: { count: 0 } });
}
