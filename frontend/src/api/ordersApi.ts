import api from './client'
import type { ApiResponse, CreateOrderPayload, CreateOrderResult, Order } from '@/types'

export const ordersApi = {
  create: (payload: CreateOrderPayload) =>
    api.post<ApiResponse<CreateOrderResult>>('/orders', payload),

  list: (params?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<Order[]>>('/orders', { params }),

  getByNumber: (orderNumber: string) =>
    api.get<ApiResponse<Order>>(`/orders/${orderNumber}`),

  getGuestReceipt: (orderNumber: string, email: string) =>
    api.get<ApiResponse<Order>>(`/orders/${orderNumber}/receipt`, { params: { email } }),

  cancel: (orderNumber: string) =>
    api.post<ApiResponse<Order>>(`/orders/${orderNumber}/cancel`),

  updateItems: (orderNumber: string, items: { productId: string; qty: number }[]) =>
    api.patch<ApiResponse<Order>>(`/orders/${orderNumber}/items`, { items }),
}
