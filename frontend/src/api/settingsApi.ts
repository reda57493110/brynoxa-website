import api from './client'
import type { ApiResponse, StoreSettings } from '@/types'

export const settingsApi = {
  get: () => api.get<ApiResponse<StoreSettings>>('/settings'),
}
