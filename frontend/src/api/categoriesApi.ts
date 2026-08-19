import api from './client'
import type { ApiResponse, Category } from '@/types'

export const categoriesApi = {
  list: (all = false) =>
    api.get<ApiResponse<Category[]>>('/categories', { params: all ? { all: true } : undefined }),
  getBySlug: (slug: string) => api.get<ApiResponse<Category>>(`/categories/${slug}`),
}
