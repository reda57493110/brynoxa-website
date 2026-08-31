import { Response } from 'express';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/tokens';
import { env, isProd } from '../config/env';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { createCipheriv, createDecipheriv } from 'crypto';
import { generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';
import { isStaffRole } from '../permissions';
import { signMfaChallenge, verifyMfaChallenge } from '../utils/tokens';
import { Resend } from 'resend';

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

function hashRecoveryCode(code: string) {
  return createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

function hashOneTimeToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

async function sendSecurityEmail(to: string, subject: string, html: string) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    if (isProd) throw new ApiError(503, 'Email delivery is not configured');
    console.warn(`Security email skipped in development for ${to}`);
    return;
  }
  const { error } = await new Resend(env.RESEND_API_KEY).emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
  });
  if (error) throw new ApiError(503, 'Security email could not be sent');
}

const ONE_TIME_TOKEN_TTL_MS = 60 * 60 * 1000;

export async function sendVerificationEmail(user: InstanceType<typeof User>) {
  const token = randomBytes(32).toString('hex');
  user.emailVerificationTokenHash = hashOneTimeToken(token);
  user.emailVerificationExpires = new Date(Date.now() + ONE_TIME_TOKEN_TTL_MS);
  await user.save({ validateBeforeSave: false });
  const link = `${env.CLIENT_URL}/verify-email?token=${encodeURIComponent(token)}`;
  await sendSecurityEmail(
    user.email,
    'Verify your Brynoxa email',
    `<p>Verify your email to finish setting up your Brynoxa account.</p><p><a href="${link}">Verify email</a></p><p>This link expires in one hour.</p>`
  );
}

export async function requestPasswordReset(email: string) {
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select(
    '+passwordResetTokenHash +passwordResetExpires'
  );
  if (!user || user.isGuest) return;
  const token = randomBytes(32).toString('hex');
  user.passwordResetTokenHash = hashOneTimeToken(token);
  user.passwordResetExpires = new Date(Date.now() + ONE_TIME_TOKEN_TTL_MS);
  await user.save({ validateBeforeSave: false });
  const link = `${env.CLIENT_URL}/reset-password?token=${encodeURIComponent(token)}`;
  await sendSecurityEmail(
    user.email,
    'Reset your Brynoxa password',
    `<p>We received a request to reset your Brynoxa password.</p><p><a href="${link}">Reset password</a></p><p>This link expires in one hour. If you did not request it, you can ignore this email.</p>`
  );
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

export async function resetPassword(token: string, newPassword: string) {
  const user = await User.findOne({
    passwordResetTokenHash: hashOneTimeToken(token),
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetTokenHash +passwordResetExpires');
  if (!user) throw new ApiError(400, 'Reset link is invalid or expired');
  user.password = newPassword;
  user.refreshToken = undefined;
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  await user.save();
}

async function verifyTotp(secret: string, code: string) {
  if (!/^\d{6}$/.test(code.trim())) return false;
  const result = await verify({ secret, token: code.trim(), epochTolerance: 1 });
  return result.valid;
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

async function recordFailedLogin(user: InstanceType<typeof User>) {
  const failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
  user.failedLoginAttempts = failedLoginAttempts;
  if (failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
    user.lockedUntil = new Date(Date.now() + LOGIN_LOCKOUT_MS);
  }
  await user.save({ validateBeforeSave: false });
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
    sameSite: isProd ? 'none' : 'lax',
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
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth',
  });
  issueCsrfToken(res, csrfToken);
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/api/v1/auth',
  });
  res.clearCookie(CSRF_COOKIE, {
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
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
    mfaEnabled: Boolean(user.mfaEnabled),
    createdAt: user.createdAt,
  };
}

export async function setupMfa(userId: string) {
  const user = await User.findById(userId).select('+mfaPendingSecretEncrypted +mfaSecretEncrypted');
  if (!user || !isStaffRole(user.role)) throw new ApiError(404, 'Staff account not found');
  if (user.mfaEnabled) throw new ApiError(409, 'MFA is already enabled');

  const secret = generateSecret({ length: 20 });
  const uri = generateURI({ issuer: 'Brynoxa', label: user.email, secret });
  user.mfaPendingSecretEncrypted = encryptMfaSecret(secret);
  await user.save({ validateBeforeSave: false });

  return { secret, qrCodeDataUrl: await QRCode.toDataURL(uri) };
}

export async function verifyMfaSetup(userId: string, code: string) {
  const user = await User.findById(userId).select('+mfaPendingSecretEncrypted');
  if (!user?.mfaPendingSecretEncrypted) throw new ApiError(400, 'Start MFA setup first');

  const secret = decryptMfaSecret(user.mfaPendingSecretEncrypted);
  if (!(await verifyTotp(secret, code))) throw new ApiError(400, 'Invalid authentication code');

  const recoveryCodes = Array.from({ length: 10 }, () => randomBytes(5).toString('hex').toUpperCase());
  user.mfaEnabled = true;
  user.mfaSecretEncrypted = user.mfaPendingSecretEncrypted;
  user.mfaPendingSecretEncrypted = undefined;
  user.mfaRecoveryCodeHashes = recoveryCodes.map(hashRecoveryCode);
  await user.save({ validateBeforeSave: false });

  return { recoveryCodes };
}

export async function disableMfa(userId: string, code: string) {
  const user = await User.findById(userId).select('+mfaSecretEncrypted');
  if (!user?.mfaEnabled || !user.mfaSecretEncrypted) {
    throw new ApiError(400, 'MFA is not enabled');
  }
  if (!(await verifyTotp(decryptMfaSecret(user.mfaSecretEncrypted), code))) {
    throw new ApiError(400, 'Invalid authentication code');
  }

  user.mfaEnabled = false;
  user.mfaSecretEncrypted = undefined;
  user.mfaPendingSecretEncrypted = undefined;
  user.mfaRecoveryCodeHashes = [];
  await user.save({ validateBeforeSave: false });
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

  if (input.password) {
    if (existing && !existing.isGuest) {
      throw new ApiError(409, 'Email already registered — please sign in');
    }

    let user = existing;
    if (user) {
      user.name = input.name;
      user.phone = input.phone || user.phone;
      user.password = input.password;
      user.isGuest = false;
      user.emailVerified = !isProd;
    } else {
      user = await User.create({
        name: input.name,
        email,
        password: input.password,
        phone: input.phone,
        isGuest: false,
        emailVerified: !isProd,
      });
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
    }

    if (isProd) {
      await user.save();
      await sendVerificationEmail(user);
      return { userId: user._id.toString(), auth: null as null };
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
  } else {
    user.name = input.name;
    if (input.phone) user.phone = input.phone;
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

  let user = exists;
  if (user) {
    user.name = input.name;
    user.password = input.password;
    user.phone = input.phone || user.phone;
    user.isGuest = false;
    user.emailVerified = !isProd;
  } else {
    user = await User.create({
      name: input.name,
      email,
      password: input.password,
      phone: input.phone,
      isGuest: false,
      emailVerified: !isProd,
    });
  }

  if (isProd) {
    await user.save();
    await sendVerificationEmail(user);
    return { verificationRequired: true as const, user: sanitizeUser(user) };
  }

  const { accessToken, refreshToken } = issueTokens(user);
  user.refreshToken = hashRefreshToken(refreshToken);
  await user.save();

  return { user: sanitizeUser(user), accessToken, refreshToken };
}

export async function loginUser(email: string, password: string) {
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    '+password +refreshToken +failedLoginAttempts +lockedUntil'
  );
  if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    throw new ApiError(429, 'Account temporarily locked. Try again later.');
  }
  if (!user || !(await user.comparePassword(password))) {
    if (user) await recordFailedLogin(user);
    throw new ApiError(401, 'Invalid email or password');
  }
  if (!user.isActive) throw new ApiError(403, 'Account is disabled');
  if (user.emailVerified === false) {
    throw new ApiError(403, 'Please verify your email before signing in');
  }
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  if (user.mfaEnabled && isStaffRole(user.role)) {
    await user.save({ validateBeforeSave: false });
    return { mfaRequired: true as const, mfaToken: signMfaChallenge(user._id.toString()) };
  }

  const payload = { userId: user._id.toString(), role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  user.refreshToken = hashRefreshToken(refreshToken);
  await user.save({ validateBeforeSave: false });

  return { user: sanitizeUser(user), accessToken, refreshToken };
}

export async function completeMfaLogin(mfaToken: string, code: string) {
  let payload;
  try {
    payload = verifyMfaChallenge(mfaToken);
  } catch {
    throw new ApiError(401, 'MFA challenge expired');
  }

  const user = await User.findById(payload.userId).select(
    '+mfaSecretEncrypted +mfaRecoveryCodeHashes +failedLoginAttempts +lockedUntil'
  );
  if (!user || !user.isActive || !user.mfaEnabled || !isStaffRole(user.role)) {
    throw new ApiError(401, 'MFA challenge is no longer valid');
  }
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    throw new ApiError(429, 'Account temporarily locked. Try again later.');
  }

  let valid = Boolean(
    user.mfaSecretEncrypted &&
      (await verifyTotp(decryptMfaSecret(user.mfaSecretEncrypted), code))
  );
  if (!valid) {
    const recoveryHash = hashRecoveryCode(code);
    const consumed = await User.updateOne(
      { _id: user._id, mfaRecoveryCodeHashes: recoveryHash },
      { $pull: { mfaRecoveryCodeHashes: recoveryHash } }
    );
    valid = consumed.modifiedCount === 1;
  }
  if (!valid) {
    await recordFailedLogin(user);
    throw new ApiError(401, 'Invalid authentication code');
  }

  const { accessToken, refreshToken } = issueTokens(user);
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  user.refreshToken = hashRefreshToken(refreshToken);
  await user.save({ validateBeforeSave: false });
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

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await User.findById(userId).select('+password');
  if (!user || !(await user.comparePassword(currentPassword))) {
    throw new ApiError(401, 'Current password is incorrect');
  }
  user.password = newPassword;
  user.refreshToken = undefined;
  await user.save();
}

export async function getMe(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');
  return sanitizeUser(user);
}

export { REFRESH_COOKIE, CSRF_COOKIE, sanitizeUser };
void env;
