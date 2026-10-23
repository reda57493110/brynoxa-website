import api from './client'
import type { ApiResponse, CouponValidation } from '@/types'

export const couponsApi = {
  /** `items`: the cart, for coupons with a special price on some products */
  validate: (code: string, subtotal: number, items?: { productId: string; qty: number }[]) =>
    api.post<ApiResponse<CouponValidation>>('/coupons/validate', { code, subtotal, items }),
}
