import api from './client'
import type { ApiResponse, CouponValidation } from '@/types'

export const couponsApi = {
  validate: (code: string, subtotal: number) =>
    api.post<ApiResponse<CouponValidation>>('/coupons/validate', { code, subtotal }),
}
