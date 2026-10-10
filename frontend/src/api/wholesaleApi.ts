import api from './client'
import type { ApiResponse, MyWholesale, WholesaleApplicationPayload, WholesaleTerms } from '@/types'

/** Signed-in customer: wholesale account status, application, and checkout pricing. */
export const wholesaleApi = {
  me: () => api.get<ApiResponse<MyWholesale>>('/wholesale/me'),
  apply: (payload: WholesaleApplicationPayload) =>
    api.post<ApiResponse<MyWholesale>>('/wholesale/application', payload),
  pricing: () => api.get<ApiResponse<{ terms: WholesaleTerms | null }>>('/wholesale/pricing'),
}
