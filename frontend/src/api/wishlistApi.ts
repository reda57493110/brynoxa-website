import api from './client'
import type { ApiResponse, Product, WishlistDoc } from '@/types'

function productsFrom(wishlist: WishlistDoc | Product[]): Product[] {
  if (Array.isArray(wishlist)) return wishlist
  return (wishlist.products || []) as Product[]
}

export const wishlistApi = {
  list: async () => {
    const res = await api.get<ApiResponse<WishlistDoc>>('/wishlist')
    return { ...res, data: { ...res.data, data: productsFrom(res.data.data) } }
  },
  add: async (productId: string) => {
    const res = await api.post<ApiResponse<WishlistDoc>>('/wishlist', { productId })
    return { ...res, data: { ...res.data, data: productsFrom(res.data.data) } }
  },
  remove: async (productId: string) => {
    const res = await api.delete<ApiResponse<WishlistDoc>>(`/wishlist/${productId}`)
    return { ...res, data: { ...res.data, data: productsFrom(res.data.data) } }
  },
  sync: async (productIds: string[]) => {
    const res = await api.post<ApiResponse<WishlistDoc>>('/wishlist/sync', { productIds })
    return { ...res, data: { ...res.data, data: productsFrom(res.data.data) } }
  },
}
