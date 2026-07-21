import api from './client'
import type { ApiResponse, Category } from '@/types'

export const categoriesApi = {
  list: () => api.get<ApiResponse<Category[]>>('/categories'),
  getBySlug: (slug: string) => api.get<ApiResponse<Category>>(`/categories/${slug}`),
}
