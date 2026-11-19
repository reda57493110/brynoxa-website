import api from './client'
import type { ApiResponse, Category } from '@/types'

export const categoriesApi = {
  list: (all = false) =>
    api.get<ApiResponse<Category[]>>('/categories', { params: all ? { all: true } : undefined }),
  /** The shop's list plus the empty sub-categories (marked `empty`), shown as "Coming soon" */
  listWithEmptySubs: () => api.get<ApiResponse<Category[]>>('/categories', { params: { emptySubs: true } }),
  getBySlug: (slug: string) => api.get<ApiResponse<Category>>(`/categories/${slug}`),
}
