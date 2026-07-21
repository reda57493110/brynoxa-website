import api from './client'
import type { ApiResponse, Product, ProductFilters } from '@/types'

function toParams(filters: ProductFilters = {}) {
  const params: Record<string, string | number | boolean> = {}
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params[key] = value
    }
  })
  return params
}

export const productsApi = {
  list: (filters?: ProductFilters) =>
    api.get<ApiResponse<Product[]>>('/products', { params: toParams(filters) }),

  getBySlug: (slug: string) => api.get<ApiResponse<Product>>(`/products/${slug}`),

  compare: (ids: string[]) =>
    api.get<ApiResponse<Product[]>>('/products/compare', {
      params: { ids: ids.join(',') },
    }),
}
