import api from './client'
import type { ApiResponse, MyWholesale, WholesaleTerms } from '@/types'

/** Signed-in customer: wholesale account status and checkout pricing (accounts are set up by staff). */
export const wholesaleApi = {
  me: () => api.get<ApiResponse<MyWholesale>>('/wholesale/me'),
  pricing: () => api.get<ApiResponse<{ terms: WholesaleTerms | null }>>('/wholesale/pricing'),
}
