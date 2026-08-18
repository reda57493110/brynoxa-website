import api from './client'
import type { ApiResponse } from '@/types'

export const contactApi = {
  sendMessage: (payload: {
    name: string
    email: string
    subject: string
    message: string
  }) => api.post<ApiResponse<{ id: string }>>('/contact', payload),

  subscribe: (email: string) =>
    api.post<ApiResponse<{ email: string }>>('/newsletter', { email }),
}
