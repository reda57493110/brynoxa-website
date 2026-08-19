import api from './client'
import type { ApiResponse, Brand } from '@/types'

export const brandsApi = {
  list: (all = false) =>
    api.get<ApiResponse<Brand[]>>('/brands', { params: all ? { all: true } : undefined }),
}
