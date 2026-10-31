import { Response } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User';
import { mfaSetupDeadline } from '../utils/mfaPolicy';
import { ApiError } from '../utils/ApiError';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/tokens';
import { env, isProd, isEmailConfigured } from '../config/env';
import { getCookieSameSite } from '../config/cookies';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { createCipheriv, createDecipheriv } from 'crypto';
import QRCode from 'qrcode';
import { isStaffRole } from '../permissions';
import { signMfaChallenge, verifyMfaChallenge } from '../utils/tokens';
import { BLOCKED_PASSWORD_MESSAGE, isBlockedPassword, isPublishedDefaultPassword } from '../utils/blockedPasswords';
import { checkPasswordEvenTime } from '../utils/passwordTiming';
import { MAX_CLOCK_SKEW_STEPS, createTotpSecret, createTotpUri, currentTotpStep, totpClockOffsetSeconds, totpStep, verifyTotpCode } from '../utils/totp';
import type { LoginRequestMeta } from './loginNotify.service';
import { sendEmail } from './email.service';
import { recordStaffSignIn } from './staffActivity.service';
import { accountLocked, clearLoginFailures, recordLoginFailure, visitorBlocked } from './loginGuard.service';
import { accountClaimEmail, notifySecurityEvent, passwordResetEmail, verificationEmail } from './accountEmail.service';

function scheduleStaffLoginNotify(
  user: { name?: string; email?: string; role?: string; phone?: string },
  meta: LoginRequestMeta = {}
) {
  setTimeout(() => {
    void import('./loginNotify.service')
      .then(({ notifyAdminStaffLogin }) => notifyAdminStaffLogin(user, meta))
      .catch((err) => console.error('Staff login notify failed:', err));
  }, 0);
}

const REFRESH_COOKIE = 'brynoxa_refresh';
const CSRF_COOKIE = 'brynoxa_csrf';

function hashRefreshToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function mfaEncryptionKey() {
  return createHash('sha256')
    .update(`${env.MFA_ENCRYPTION_KEY || env.JWT_REFRESH_SECRET}:mfa`)
    .digest();
}

function encryptMfaSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', mfaEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64')).join('.');
}

function decryptMfaSecret(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split('.');
  if (!ivValue || !tagValue || !encryptedValue) throw new ApiError(500, 'Invalid MFA configuration');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    mfaEncryptionKey(),
    Buffer.from(ivValue, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function hashOneTimeToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

/** Verification / reset emails: the user is waiting for them, so a failed send is reported. */
async function sendSecurityEmail(to: string, email: { subject: string; html: string; text: string }) {
  if (!isEmailConfigured()) {
    console.warn('Security email skipped (Resend not configured)');
    return;
  }
  const sent = await sendEmail({ to, ...email });
  if (!sent) throw new ApiError(503, 'Security email could not be sent');
}

const ONE_TIME_TOKEN_TTL_MS = 60 * 60 * 1000;

export async function sendVerificationEmail(user: InstanceType<typeof User>) {
  const token = randomBytes(32).toString('hex');
  user.emailVerificationTokenHash = hashOneTimeToken(token);
  user.emailVerificationExpires = new Date(Date.now() + ONE_TIME_TOKEN_TTL_MS);
  await user.save({ validateBeforeSave: false });
  const link = `${env.CLIENT_URL}/verify-email?token=${encodeURIComponent(token)}`;
  await sendSecurityEmail(user.email, verificationEmail(user, link));
}

export async function requestPasswordReset(email: string) {
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select(
    '+passwordResetTokenHash +passwordResetExpires'
  );
  if (!user) return;
  // Staff passwords are set by the owner: no reset link (same quiet answer as an unknown email)
  if (isStaffRole(user.role) && user.role !== 'admin') return;
  // A guest (ordered without an account) gets the same one-time link to choose a password
  await sendPasswordLink(user, user.isGuest ? accountClaimEmail : passwordResetEmail);
}

/** One-time "choose a password" link; whoever uses it proves they own the email. */
async function sendPasswordLink(
  user: InstanceType<typeof User>,
  template: (user: InstanceType<typeof User>, link: string, code: string) => { subject: string; html: string; text: string }
) {
  const token = randomBytes(32).toString('hex');
  user.passwordResetTokenHash = hashOneTimeToken(token);
  user.passwordResetExpires = new Date(Date.now() + ONE_TIME_TOKEN_TTL_MS);
  // The same email carries a 6-digit code, for people who type it on the site instead
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  user.passwordResetCodeHash = resetCodeHash(user._id, code);
  user.passwordResetCodeExpires = new Date(Date.now() + RESET_CODE_TTL_MS);
  user.passwordResetCodeTries = 0;
  await user.save({ validateBeforeSave: false });
  const link = `${env.CLIENT_URL}/reset-password?token=${encodeURIComponent(token)}`;
  await sendSecurityEmail(user.email, template(user, link, code));
}

/** The emailed reset code: valid 15 minutes, 5 wrong tries cancel it (a new email sends a new one). */
export const RESET_CODE_TTL_MS = 15 * 60 * 1000;
export const RESET_CODE_MAX_TRIES = 5;

function resetCodeHash(userId: unknown, code: string) {
  return hashOneTimeToken(`reset-code:${String(userId)}:${code}`);
}

/**
 * Forgot password → the customer types the 6-digit code from the email. A right code is swapped
 * for a one-time key (15 min) that opens the "choose a new password" step; the code is used up.
 * Unknown email, no code, expired or wrong code all get the same answer.
 */
export async function verifyPasswordResetCode(email: string, code: string) {
  const wrong = () => new ApiError(400, 'This code is wrong or has expired');
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select(
    '+passwordResetTokenHash +passwordResetExpires +passwordResetCodeHash +passwordResetCodeExpires +passwordResetCodeTries'
  );
  if (!user || !user.passwordResetCodeHash || !user.passwordResetCodeExpires || user.passwordResetCodeExpires.getTime() <= Date.now()) {
    throw wrong();
  }
  const expected = Buffer.from(user.passwordResetCodeHash, 'hex');
  const given = Buffer.from(resetCodeHash(user._id, code.replace(/\s/g, '')), 'hex');
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    const tries = (user.passwordResetCodeTries || 0) + 1;
    if (tries >= RESET_CODE_MAX_TRIES) {
      user.passwordResetCodeHash = undefined;
      user.passwordResetCodeExpires = undefined;
      user.passwordResetCodeTries = undefined;
    } else {
      user.passwordResetCodeTries = tries;
    }
    await user.save({ validateBeforeSave: false });
    throw wrong();
  }
  const token = randomBytes(32).toString('hex');
  user.passwordResetTokenHash = hashOneTimeToken(token);
  user.passwordResetExpires = new Date(Date.now() + RESET_CODE_TTL_MS);
  user.passwordResetCodeHash = undefined;
  user.passwordResetCodeExpires = undefined;
  user.passwordResetCodeTries = undefined;
  await user.save({ validateBeforeSave: false });
  return { token };
}

/** How long a reset link made by the owner (sent on WhatsApp) stays valid. */
export const STAFF_RESET_LINK_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Admin → customer → "Password reset link": a customer who forgot their password asks on
 * WhatsApp (emails are off). The owner gets the same one-time link the email would carry and
 * sends it; the customer chooses the new password themselves (the owner never knows it). Valid
 * 24 hours, once; a new link replaces the previous one. Customer accounts only.
 */
export async function createPasswordLinkForCustomer(customerId: string) {
  if (!mongoose.isValidObjectId(customerId)) throw new ApiError(404, 'Customer not found');
  const user = await User.findById(customerId).select('+passwordResetTokenHash +passwordResetExpires');
  if (!user || user.role !== 'customer') throw new ApiError(404, 'Customer not found');
  if (!user.isActive) throw new ApiError(400, 'This account is disabled: enable it first');
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + STAFF_RESET_LINK_TTL_MS);
  user.passwordResetTokenHash = hashOneTimeToken(token);
  user.passwordResetExpires = expiresAt;
  await user.save({ validateBeforeSave: false });
  return {
    link: `${env.CLIENT_URL}/reset-password?token=${encodeURIComponent(token)}`,
    expiresAt,
    name: user.name,
    phone: user.phone,
  };
}

/**
 * Someone wants an account for an email that already has guest orders. The account is only
 * handed over through a link sent to that email — never in the request itself.
 */
async function startGuestClaim(guestId: unknown) {
  if (!isEmailConfigured()) {
    throw new ApiError(409, 'You already ordered with this email. Please contact us to activate your account.');
  }
  const user = await User.findById(guestId).select('+passwordResetTokenHash +passwordResetExpires');
  if (!user || !user.isGuest) throw new ApiError(409, 'Email already registered');
  await sendPasswordLink(user, accountClaimEmail);
}

export async function resendVerificationEmail(email: string) {
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user || user.emailVerified !== false) return;
  await sendVerificationEmail(user);
}

export async function verifyEmail(token: string) {
  const user = await User.findOne({
    emailVerificationTokenHash: hashOneTimeToken(token),
    emailVerificationExpires: { $gt: new Date() },
  }).select('+emailVerificationTokenHash +emailVerificationExpires');
  if (!user) throw new ApiError(400, 'Verification link is invalid or expired');
  user.emailVerified = true;
  user.emailVerificationTokenHash = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });
}

const CUSTOMER_PASSWORD_MIN = 6;
const STAFF_PASSWORD_MIN = 12;

/** Staff other than the owner: their password is set by the owner (Admin → Roles). */
function assertOwnPasswordAllowed(role: string | undefined) {
  if (isStaffRole(role) && role !== 'admin') {
    throw new ApiError(403, 'Staff passwords are set by the owner — ask the owner to change yours');
  }
}

function assertPasswordLength(role: string | undefined, password: string) {
  if (isBlockedPassword(password)) throw new ApiError(400, BLOCKED_PASSWORD_MESSAGE);
  const min = isStaffRole(role) ? STAFF_PASSWORD_MIN : CUSTOMER_PASSWORD_MIN;
  if (password.length < min) {
    throw new ApiError(
      400,
      isStaffRole(role)
        ? `Staff passwords must be at least ${min} characters`
        : `Password must be at least ${min} characters`
    );
  }
}

export async function resetPassword(token: string, newPassword: string) {
  const user = await User.findOne({
    passwordResetTokenHash: hashOneTimeToken(token),
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetTokenHash +passwordResetExpires');
  if (!user) throw new ApiError(400, 'Reset link is invalid or expired');
  assertOwnPasswordAllowed(user.role);
  assertPasswordLength(user.role, newPassword);
  user.password = newPassword;
  user.passwordChangedAt = new Date();
  user.refreshToken = undefined;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.passwordResetCodeHash = undefined;
  user.passwordResetCodeExpires = undefined;
  user.passwordResetCodeTries = undefined;
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  // Using the emailed link proves the email: a guest record becomes a real account
  if (user.isGuest) {
    user.isGuest = false;
    user.emailVerified = true;
  }
  await user.save();
  notifySecurityEvent(user, 'password-reset');
}

async function verifyTotp(secret: string, code: string) {
  return verifyTotpCode(secret, code);
}

/**
 * Checks a 2-step code for sign-in / turning 2-step off and uses it up: a code (or an older one)
 * that was already used is refused, so a code seen over someone's shoulder cannot be replayed.
 */
async function consumeTotp(user: InstanceType<typeof User>, code: string) {
  if (!user.mfaSecretEncrypted) return false;
  const secret = decryptMfaSecret(user.mfaSecretEncrypted);
  const skew = user.mfaClockSkewSteps || 0;
  // Around the phone's known clock difference; also the real time, in case the phone was fixed
  const step = totpStep(secret, code, skew) ?? (skew ? totpStep(secret, code, 0) : null);
  if (step === null) return false;
  // Keep following the phone's clock as it drifts
  const newSkew = Math.max(-MAX_CLOCK_SKEW_STEPS, Math.min(MAX_CLOCK_SKEW_STEPS, step - currentTotpStep()));
  const res = await User.updateOne(
    { _id: user._id, $or: [{ mfaLastStep: { $exists: false } }, { mfaLastStep: { $lt: step } }] },
    { $set: { mfaLastStep: step, mfaClockSkewSteps: newSkew } }
  );
  return res.modifiedCount === 1;
}


export async function migrateRefreshTokens() {
  const users = await User.find({ refreshToken: { $exists: true } }).select('+refreshToken');
  let migrated = 0;
  for (const user of users) {
    if (user.refreshToken && !/^[a-f0-9]{64}$/i.test(user.refreshToken)) {
      await User.updateOne({ _id: user._id }, { $set: { refreshToken: hashRefreshToken(user.refreshToken) } });
      migrated += 1;
    }
  }
  if (migrated > 0) console.log(`Migrated ${migrated} refresh token(s) to hashed storage`);
}

export function setCsrfCookie(res: Response, csrfToken: string) {
  res.cookie(CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    secure: isProd,
    sameSite: getCookieSameSite(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth',
  });
}

export function issueCsrfToken(res: Response, existingToken?: string) {
  const csrfToken = existingToken || randomBytes(32).toString('hex');
  setCsrfCookie(res, csrfToken);
  return csrfToken;
}

export function csrfMatches(cookieToken?: string, headerToken?: string) {
  if (!cookieToken || !headerToken || cookieToken.length !== headerToken.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));
}

export function setRefreshCookie(res: Response, token: string, csrfToken?: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: getCookieSameSite(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth',
  });
  issueCsrfToken(res, csrfToken);
}

export function clearRefreshCookie(res: Response) {
  const sameSite = getCookieSameSite();
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: isProd,
    sameSite,
    path: '/api/v1/auth',
  });
  res.clearCookie(CSRF_COOKIE, {
    secure: isProd,
    sameSite,
    path: '/api/v1/auth',
  });
}

function sanitizeUser(user: InstanceType<typeof User>) {
  return {
    _id: user._id,
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    addresses: user.addresses,
    avatar: user.avatar,
    isActive: user.isActive,
    isGuest: Boolean(user.isGuest),
    customerType: user.customerType || 'retail',
    wholesaleStatus: user.wholesale?.status || 'none',
    mfaEnabled: Boolean(user.mfaEnabled),
    // Staff without 2-step: last day to turn it on (the admin shows a reminder, then asks for it)
    mfaSetupDeadline: mfaSetupDeadline(user)?.toISOString() ?? null,
    createdAt: user.createdAt,
  };
}

export async function setupMfa(userId: string, options?: { rotate?: boolean }) {
  const user = await User.findById(userId).select('+mfaPendingSecretEncrypted +mfaSecretEncrypted');
  if (!user || !isStaffRole(user.role)) throw new ApiError(404, 'Staff account not found');
  if (user.role !== 'admin') throw new ApiError(403, '2-step sign-in is for the owner account');
  if (user.mfaEnabled) throw new ApiError(409, 'MFA is already enabled');

  // Keep the pending key unless a new QR code is asked for: opening setup again (another tab,
  // a second click) must not replace the key the phone already scanned
  const rotate = options?.rotate === true || !user.mfaPendingSecretEncrypted;
  let secret: string;
  if (!rotate && user.mfaPendingSecretEncrypted) {
    secret = decryptMfaSecret(user.mfaPendingSecretEncrypted);
  } else {
    secret = await createTotpSecret(20);
    user.mfaPendingSecretEncrypted = encryptMfaSecret(secret);
    await user.save({ validateBeforeSave: false });
  }

  const uri = await createTotpUri({ issuer: 'Brynoxa', label: user.email, secret });
  return { secret, qrCodeDataUrl: await QRCode.toDataURL(uri) };
}

export async function verifyMfaSetup(userId: string, code: string, shownSecret?: string) {
  const user = await User.findById(userId).select('+mfaPendingSecretEncrypted');
  if (!user?.mfaPendingSecretEncrypted) throw new ApiError(400, 'Start MFA setup first');

  const secret = decryptMfaSecret(user.mfaPendingSecretEncrypted);
  // The phone's clock difference: 0 normally, or learned below (up to 10 minutes)
  let skewSteps = 0;
  if (!(await verifyTotp(secret, code))) {
    // Tell the person exactly what went wrong (none of these turn 2-step on)
    const shown = (shownSecret || '').replace(/\s/g, '').toUpperCase();
    if (shown && shown !== secret) {
      throw new ApiError(400, 'This QR code was replaced (by another tab or by "New QR code"). Close the other tabs, press "New QR code", delete the old Brynoxa entry in your app and scan the new one.');
    }
    const offset = totpClockOffsetSeconds(secret, code);
    if (offset !== null && Math.abs(offset) <= MAX_CLOCK_SKEW_STEPS * 30) {
      // Right code from a phone whose clock is a few minutes off: accept and remember the difference
      skewSteps = Math.round(offset / 30);
    } else if (offset !== null) {
      const minutes = Math.max(1, Math.round(Math.abs(offset) / 60));
      throw new ApiError(400, `Your phone's time is about ${minutes} minute${minutes === 1 ? '' : 's'} ${offset < 0 ? 'behind' : 'ahead'}. Turn on automatic date & time on your phone, then type the new code.`);
    } else {
      throw new ApiError(400, 'That code does not belong to this QR code. Delete every Brynoxa entry in your app, scan this QR code again, and type the code it shows right now.');
    }
  }

  // Only the authenticator app's code is accepted (no recovery codes, owner's choice)
  user.mfaEnabled = true;
  user.mfaSecretEncrypted = user.mfaPendingSecretEncrypted;
  user.mfaPendingSecretEncrypted = undefined;
  user.mfaRecoveryCodeHashes = [];
  user.mfaClockSkewSteps = skewSteps;
  // The setup code itself cannot be used again to sign in (the next codes can)
  const setupStep = totpStep(secret, code, skewSteps);
  if (setupStep !== null) user.mfaLastStep = setupStep;
  await user.save({ validateBeforeSave: false });
  notifySecurityEvent(user, 'mfa-enabled');

  return { recoveryCodes: [] as string[] };
}

export async function disableMfa(userId: string, code: string) {
  const user = await User.findById(userId).select('+mfaSecretEncrypted +mfaRecoveryCodeHashes +mfaClockSkewSteps');
  if (!user?.mfaEnabled || !user.mfaSecretEncrypted) {
    throw new ApiError(400, 'MFA is not enabled');
  }

  const valid = await consumeTotp(user, code);
  if (!valid) throw new ApiError(400, 'Invalid authentication code');

  user.mfaEnabled = false;
  user.mfaSecretEncrypted = undefined;
  user.mfaPendingSecretEncrypted = undefined;
  user.mfaRecoveryCodeHashes = [];
  await user.save({ validateBeforeSave: false });
  notifySecurityEvent(user, 'mfa-disabled');
}

function issueTokens(user: InstanceType<typeof User>) {
  const payload = { userId: user._id.toString(), role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  return { accessToken, refreshToken };
}

/**
 * Resolve who owns a checkout order.
 * Logged-in users keep their account.
 * Guests provide email; optional password creates / upgrades a real account.
 */
export async function resolveCheckoutCustomer(input: {
  authenticatedUserId?: string;
  email?: string;
  name: string;
  phone?: string;
  password?: string;
  shippingAddress?: {
    label?: string;
    fullName: string;
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postalCode?: string;
    country?: string;
    phone: string;
  };
}) {
  if (input.authenticatedUserId) {
    return { userId: input.authenticatedUserId as string, auth: null as null };
  }

  const email = input.email?.trim().toLowerCase();
  if (!email) throw new ApiError(400, 'Email is required to place an order');

  const existing = await User.findOne({ email }).select('+password +refreshToken');

  if (input.password && existing && !existing.isGuest) {
    throw new ApiError(409, 'Email already registered — please sign in');
  }

  // Earlier guest orders use this email: the order goes through as a guest and a link to choose
  // a password is emailed, instead of handing the account (and its orders) to whoever typed it
  if (input.password && existing?.isGuest) {
    if (isEmailConfigured()) {
      try {
        await startGuestClaim(existing._id);
      } catch (err) {
        console.warn('Account claim email failed', err);
      }
    }
  } else if (input.password) {
    const user = await User.create({
      name: input.name,
      email,
      password: input.password,
      phone: input.phone,
      isGuest: false,
      emailVerified: true,
    });

    if (input.shippingAddress && user.addresses.length === 0) {
      user.addresses.push({
        label: input.shippingAddress.label || 'Home',
        fullName: input.shippingAddress.fullName,
        line1: input.shippingAddress.line1,
        line2: input.shippingAddress.line2,
        city: input.shippingAddress.city,
        state: input.shippingAddress.state,
        postalCode: input.shippingAddress.postalCode || '00000',
        country: input.shippingAddress.country || 'MA',
        phone: input.shippingAddress.phone,
        isDefault: true,
      });
    }

    const { accessToken, refreshToken } = issueTokens(user);
    user.refreshToken = hashRefreshToken(refreshToken);
    await user.save();

    return {
      userId: user._id.toString(),
      auth: { user: sanitizeUser(user), accessToken, refreshToken },
    };
  }

  if (existing && !existing.isGuest) {
    throw new ApiError(409, 'An account exists with this email — please sign in');
  }

  let user = existing;
  if (!user) {
    const crypto = await import('crypto');
    const randomPassword = crypto.randomBytes(24).toString('hex');
    user = await User.create({
      name: input.name,
      email,
      password: randomPassword,
      phone: input.phone,
      isGuest: true,
    });
  } else if (!user.phone && input.phone) {
    // Existing guest: anyone can type this email, so only fill in what is missing
    user.phone = input.phone;
  }

  if (input.shippingAddress && user.addresses.length === 0) {
    user.addresses.push({
      label: input.shippingAddress.label || 'Home',
      fullName: input.shippingAddress.fullName,
      line1: input.shippingAddress.line1,
      line2: input.shippingAddress.line2,
      city: input.shippingAddress.city,
      state: input.shippingAddress.state,
      postalCode: input.shippingAddress.postalCode || '00000',
      country: input.shippingAddress.country || 'MA',
      phone: input.shippingAddress.phone,
      isDefault: true,
    });
    await user.save();
  } else if (user.isModified()) {
    await user.save();
  }

  return { userId: user._id.toString(), auth: null as null };
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}) {
  const email = input.email.toLowerCase();
  const exists = await User.findOne({ email }).select('+password +refreshToken');
  if (exists && !exists.isGuest) throw new ApiError(409, 'Email already registered');

  // Guest orders already use this email: the owner confirms through an emailed link
  if (exists) {
    await startGuestClaim(exists._id);
    return { verificationRequired: true as const };
  }

  const user = await User.create({
    name: input.name,
    email,
    password: input.password,
    phone: input.phone,
    isGuest: false,
    emailVerified: true,
  });

  const { accessToken, refreshToken } = issueTokens(user);
  user.refreshToken = hashRefreshToken(refreshToken);
  await user.save();

  return { user: sanitizeUser(user), accessToken, refreshToken };
}

export async function loginUser(
  email: string,
  password: string,
  meta: LoginRequestMeta = {}
) {
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    '+password +refreshToken +failedLoginAttempts +lockedUntil'
  );
  // The password is always checked (against a dummy when the email is unknown, and also while
  // locked), so the time taken never tells whether an email has an account
  const passwordOk = await checkPasswordEvenTime(password, user?.password);
  // Blocked: this visitor after too many wrong tries, or the account after an attack from many places
  if (user && (accountLocked(user) || (await visitorBlocked(user._id, meta.ip)))) {
    throw new ApiError(429, 'Account temporarily locked. Try again later.');
  }
  // The old published default never signs anyone in (counted as a wrong password)
  if (!user || isPublishedDefaultPassword(password) || !passwordOk) {
    if (user) await recordLoginFailure(user._id, meta.ip);
    throw new ApiError(401, 'Invalid email or password');
  }
  if (!user.isActive) throw new ApiError(403, 'Account is disabled');
  if (user.emailVerified === false && isStaffRole(user.role)) {
    throw new ApiError(403, 'Please verify your email before signing in');
  }
  if (user.mfaEnabled && isStaffRole(user.role)) {
    // Failed-attempt count is only cleared once the code is also right (completeMfaLogin)
    return { mfaRequired: true as const, mfaToken: signMfaChallenge(user._id.toString()) };
  }
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  await clearLoginFailures(user._id, meta.ip);

  const payload = { userId: user._id.toString(), role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  user.refreshToken = hashRefreshToken(refreshToken);
  await user.save({ validateBeforeSave: false });

  if (isStaffRole(user.role)) {
    recordStaffSignIn(user._id.toString(), user.role);
    scheduleStaffLoginNotify(
      { name: user.name, email: user.email, role: user.role, phone: user.phone },
      meta
    );
  }

  return { user: sanitizeUser(user), accessToken, refreshToken };
}

export async function completeMfaLogin(
  mfaToken: string,
  code: string,
  meta: LoginRequestMeta = {}
) {
  let payload;
  try {
    payload = verifyMfaChallenge(mfaToken);
  } catch {
    throw new ApiError(401, 'MFA challenge expired');
  }

  const user = await User.findById(payload.userId).select(
    '+mfaSecretEncrypted +mfaRecoveryCodeHashes +mfaClockSkewSteps +failedLoginAttempts +lockedUntil'
  );
  if (!user || !user.isActive || !user.mfaEnabled || !isStaffRole(user.role)) {
    throw new ApiError(401, 'MFA challenge is no longer valid');
  }
  if (accountLocked(user) || (await visitorBlocked(user._id, meta.ip))) {
    throw new ApiError(429, 'Account temporarily locked. Try again later.');
  }

  const valid = await consumeTotp(user, code);
  if (!valid) {
    await recordLoginFailure(user._id, meta.ip);
    throw new ApiError(401, 'Invalid authentication code');
  }

  const { accessToken, refreshToken } = issueTokens(user);
  // Recovery codes are no longer used: clear any left from before
  user.mfaRecoveryCodeHashes = [];
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  await clearLoginFailures(user._id, meta.ip);
  user.refreshToken = hashRefreshToken(refreshToken);
  await user.save({ validateBeforeSave: false });

  recordStaffSignIn(user._id.toString(), user.role);
  scheduleStaffLoginNotify(
    { name: user.name, email: user.email, role: user.role, phone: user.phone },
    meta
  );

  return { user: sanitizeUser(user), accessToken, refreshToken };
}

export async function refreshSession(cookieToken?: string) {
  if (!cookieToken) throw new ApiError(401, 'Refresh token missing');
  let payload;
  try {
    payload = verifyRefreshToken(cookieToken);
  } catch {
    throw new ApiError(401, 'Invalid refresh token');
  }

  const user = await User.findById(payload.userId).select('+refreshToken');
  if (!user || !user.isActive) {
    throw new ApiError(401, 'Session expired');
  }
  if (user.refreshToken !== hashRefreshToken(cookieToken)) {
    await User.updateOne({ _id: user._id }, { $unset: { refreshToken: 1 } });
    throw new ApiError(401, 'Session expired');
  }

  const nextPayload = { userId: user._id.toString(), role: user.role };
  const accessToken = signAccessToken(nextPayload);
  const refreshToken = signRefreshToken(nextPayload);
  user.refreshToken = hashRefreshToken(refreshToken);
  await user.save({ validateBeforeSave: false });

  return { user: sanitizeUser(user), accessToken, refreshToken };
}

export async function logoutUser(userId: string) {
  await User.findByIdAndUpdate(userId, { $unset: { refreshToken: 1 } });
}

/**
 * Sign-out after the short access token expired: the session cookie still names the session, so
 * it is ended on the server too (not only forgotten by this browser). Only when the cookie is
 * that account's current session.
 */
export async function logoutByRefreshToken(cookieToken?: string) {
  if (!cookieToken) return;
  let payload;
  try {
    payload = verifyRefreshToken(cookieToken);
  } catch {
    return;
  }
  await User.updateOne(
    { _id: payload.userId, refreshToken: hashRefreshToken(cookieToken) },
    { $unset: { refreshToken: 1 } }
  );
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  meta: LoginRequestMeta = {}
) {
  // Guessing the current password from a signed-in browser is limited like sign-in
  if (await visitorBlocked(userId, meta.ip)) {
    throw new ApiError(429, 'Too many wrong passwords. Please wait 15 minutes and try again.');
  }
  const user = await User.findById(userId).select('+password');
  if (!user || !(await user.comparePassword(currentPassword))) {
    if (user) await recordLoginFailure(user._id, meta.ip);
    throw new ApiError(401, 'Current password is incorrect');
  }
  assertOwnPasswordAllowed(user.role);
  assertPasswordLength(user.role, newPassword);
  user.password = newPassword;
  user.passwordChangedAt = new Date();
  user.refreshToken = undefined;
  await user.save();
  notifySecurityEvent(user, 'password-changed');
}

export async function getMe(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');
  return sanitizeUser(user);
}

export { REFRESH_COOKIE, CSRF_COOKIE, sanitizeUser };
void env;
