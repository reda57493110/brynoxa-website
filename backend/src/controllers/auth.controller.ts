import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import * as authService from '../services/auth.service';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { param } from '../utils/params';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.registerUser(req.body);
  authService.setRefreshCookie(res, result.refreshToken);
  sendSuccess(res, { user: result.user, accessToken: result.accessToken }, 'Registered', 201);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.loginUser(req.body.email, req.body.password);
  authService.setRefreshCookie(res, result.refreshToken);
  sendSuccess(res, { user: result.user, accessToken: result.accessToken }, 'Logged in');
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[authService.REFRESH_COOKIE];
  if (!token) {
    sendSuccess(res, { user: null, accessToken: null }, 'No session');
    return;
  }
  try {
    const result = await authService.refreshSession(token);
    authService.setRefreshCookie(res, result.refreshToken);
    sendSuccess(res, { user: result.user, accessToken: result.accessToken }, 'Token refreshed');
  } catch (err) {
    authService.clearRefreshCookie(res);
    throw err;
  }
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.userId) await authService.logoutUser(req.user.userId);
  authService.clearRefreshCookie(res);
  sendSuccess(res, null, 'Logged out');
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getMe(req.user!.userId);
  sendSuccess(res, user);
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findByIdAndUpdate(
    req.user!.userId,
    { $set: req.body },
    { new: true, runValidators: true }
  );
  if (!user) throw new ApiError(404, 'User not found');
  sendSuccess(res, authService.sanitizeUser(user), 'Profile updated');
});

export const addAddress = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.userId);
  if (!user) throw new ApiError(404, 'User not found');
  if (req.body.isDefault || user.addresses.length === 0) {
    user.addresses.forEach((a) => {
      a.isDefault = false;
    });
    req.body.isDefault = true;
  }
  user.addresses.push(req.body);
  await user.save();
  sendSuccess(res, authService.sanitizeUser(user), 'Address added', 201);
});

export const updateAddress = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.userId);
  if (!user) throw new ApiError(404, 'User not found');
  const addressId = param(req, 'id');
  const address = user.addresses.find((a) => a._id?.toString() === addressId);
  if (!address) throw new ApiError(404, 'Address not found');
  Object.assign(address, req.body);
  if (req.body.isDefault) {
    user.addresses.forEach((a) => {
      a.isDefault = a._id?.toString() === addressId;
    });
  }
  await user.save();
  sendSuccess(res, authService.sanitizeUser(user), 'Address updated');
});

export const deleteAddress = asyncHandler(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.userId);
  if (!user) throw new ApiError(404, 'User not found');
  const addressId = param(req, 'id');
  user.addresses = user.addresses.filter((a) => a._id?.toString() !== addressId) as typeof user.addresses;
  await user.save();
  sendSuccess(res, authService.sanitizeUser(user), 'Address removed');
});
