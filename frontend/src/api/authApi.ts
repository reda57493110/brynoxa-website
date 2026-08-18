import api from './client'
import type { Address, ApiResponse, AuthPayload, SessionPayload, User } from '@/types'

export const authApi = {
  register: (payload: { name: string; email: string; password: string; phone?: string }) =>
    api.post<ApiResponse<AuthPayload>>('/auth/register', payload),

  login: (payload: { email: string; password: string }) =>
    api.post<ApiResponse<AuthPayload>>('/auth/login', payload),

  refresh: () => api.post<ApiResponse<SessionPayload>>('/auth/refresh'),

  logout: () => api.post<ApiResponse<null>>('/auth/logout'),

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
