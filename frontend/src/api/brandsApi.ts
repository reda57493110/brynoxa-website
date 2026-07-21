import api from './client'
import type { ApiResponse, Brand } from '@/types'

export const brandsApi = {
  list: () => api.get<ApiResponse<Brand[]>>('/brands'),
}
