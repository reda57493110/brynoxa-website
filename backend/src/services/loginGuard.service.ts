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

type Db = { collection: (name: string) => any };
type Id = Types.ObjectId | string;

// No database connection (tests of other parts): no counting, like the other limits
const defaultDb = (): Db | undefined => mongoose.connection.db as unknown as Db | undefined;
const windowStart = () => Math.floor(Date.now() / LOGIN_LOCKOUT_MS) * LOGIN_LOCKOUT_MS;
const visitorKey = (userId: Id, ip?: string) =>
  `loginFail:${String(userId)}:${String(ip || 'unknown').slice(0, 64)}:${windowStart()}`;

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

/** Counts a wrong password / code, atomically (a burst of attempts all count). */
export async function recordLoginFailure(userId: Id, ip?: string, db: Db | undefined = defaultDb()) {
  if (!db) return;
  await db.collection('rate_limits').findOneAndUpdate(
    { _id: visitorKey(userId, ip) },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(windowStart() + LOGIN_LOCKOUT_MS) } },
    { upsert: true, returnDocument: 'after' }
  );
  const users = db.collection('users');
  const updated = await users.findOneAndUpdate({ _id: userId }, { $inc: { failedLoginAttempts: 1 } }, { returnDocument: 'after' });
  // Driver v6 returns the document; older versions wrap it in { value }
  const after = updated && typeof updated.failedLoginAttempts === 'number' ? updated : updated?.value;
  if ((after?.failedLoginAttempts || 0) >= ACCOUNT_MAX_FAILURES) {
    await users.updateOne({ _id: userId }, { $set: { lockedUntil: new Date(Date.now() + LOGIN_LOCKOUT_MS), failedLoginAttempts: 0 } });
  }
}

/** A successful sign-in clears this visitor's count. */
export async function clearLoginFailures(userId: Id, ip?: string, db: Db | undefined = defaultDb()) {
  if (!db) return;
  await db.collection('rate_limits').updateOne({ _id: visitorKey(userId, ip) }, { $set: { count: 0 } });
}
