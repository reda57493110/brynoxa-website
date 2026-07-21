import api from './client'
import type { ApiResponse, Review } from '@/types'

export const reviewsApi = {
  forProduct: (productId: string, params?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<Review[]>>(`/products/${productId}/reviews`, { params }),

  mine: (params?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<Review[]>>('/reviews/me', { params }),

  create: (payload: { productId: string; rating: number; title: string; comment: string }) =>
    api.post<ApiResponse<Review>>('/reviews', payload),
}
