import { Response } from 'express';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/tokens';
import { env, isProd } from '../config/env';

const REFRESH_COOKIE = 'brynoxa_refresh';

export function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth',
  });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
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
    createdAt: user.createdAt,
  };
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
    } else {
      user = await User.create({
        name: input.name,
        email,
        password: input.password,
        phone: input.phone,
        isGuest: false,
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

    const { accessToken, refreshToken } = issueTokens(user);
    user.refreshToken = refreshToken;
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
  } else {
    user = await User.create({
      name: input.name,
      email,
      password: input.password,
      phone: input.phone,
      isGuest: false,
    });
  }

  const { accessToken, refreshToken } = issueTokens(user);
  user.refreshToken = refreshToken;
  await user.save();

  return { user: sanitizeUser(user), accessToken, refreshToken };
}

export async function loginUser(email: string, password: string) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password +refreshToken');
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password');
  }
  if (!user.isActive) throw new ApiError(403, 'Account is disabled');

  const payload = { userId: user._id.toString(), role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  user.refreshToken = refreshToken;
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
  if (!user || !user.isActive || user.refreshToken !== cookieToken) {
    throw new ApiError(401, 'Session expired');
  }

  const nextPayload = { userId: user._id.toString(), role: user.role };
  const accessToken = signAccessToken(nextPayload);
  const refreshToken = signRefreshToken(nextPayload);
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  return { user: sanitizeUser(user), accessToken, refreshToken };
}

export async function logoutUser(userId: string) {
  await User.findByIdAndUpdate(userId, { $unset: { refreshToken: 1 } });
}

export async function getMe(userId: string) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found');
  return sanitizeUser(user);
}

export { REFRESH_COOKIE, sanitizeUser };
void env;
