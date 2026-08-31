import api, { resetSessionCheck } from './client'
import type { Address, ApiResponse, AuthPayload, SessionPayload, User } from '@/types'

export const authApi = {
  register: (payload: { name: string; email: string; password: string; phone?: string }) =>
    api.post<ApiResponse<AuthPayload>>('/auth/register', payload),

  login: (payload: { email: string; password: string }) =>
    api.post<ApiResponse<AuthPayload>>('/auth/login', payload),

  requestPasswordReset: (email: string) =>
    api.post<ApiResponse<null>>('/auth/password-reset/request', { email }),

  resendVerification: (email: string) =>
    api.post<ApiResponse<null>>('/auth/verification/resend', { email }),

  verifyEmail: (token: string) =>
    api.post<ApiResponse<null>>('/auth/verification/confirm', { token }),

  resetPassword: (payload: { token: string; newPassword: string }) =>
    api.post<ApiResponse<null>>('/auth/password-reset/confirm', payload),

  completeMfaLogin: (payload: { mfaToken: string; code: string }) =>
    api.post<ApiResponse<AuthPayload>>('/auth/mfa/login', payload),

  setupMfa: () =>
    api.post<ApiResponse<{ secret: string; qrCodeDataUrl: string }>>('/auth/mfa/setup'),

  verifyMfaSetup: (code: string) =>
    api.post<ApiResponse<{ recoveryCodes: string[] }>>('/auth/mfa/verify', { code }),

  disableMfa: (code: string) =>
    api.post<ApiResponse<null>>('/auth/mfa/disable', { code }),

  refresh: () => api.post<ApiResponse<SessionPayload>>('/auth/refresh'),

  logout: async () => {
    try {
      return await api.post<ApiResponse<null>>('/auth/logout')
    } finally {
      resetSessionCheck()
    }
  },

  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    api.post<ApiResponse<null>>('/auth/change-password', payload),

  me: () => api.get<ApiResponse<User>>('/auth/me'),

  updateProfile: (payload: { name?: string; phone?: string }) =>
    api.patch<ApiResponse<User>>('/auth/me', payload),

  addAddress: (payload: Omit<Address, '_id'>) =>
    api.post<ApiResponse<User>>('/auth/me/addresses', payload),

  updateAddress: (id: string, payload: Partial<Address>) =>
    api.patch<ApiResponse<User>>(`/auth/me/addresses/${id}`, payload),

  deleteAddress: (id: string) =>
    api.delete<ApiResponse<User>>(`/auth/me/addresses/${id}`),
}
