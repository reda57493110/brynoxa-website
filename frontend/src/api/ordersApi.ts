import api from './client'
import type { ApiResponse, CreateOrderPayload, Order } from '@/types'

export const ordersApi = {
  create: (payload: CreateOrderPayload) =>
    api.post<ApiResponse<Order>>('/orders', payload),

  list: (params?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<Order[]>>('/orders', { params }),

  getByNumber: (orderNumber: string) =>
    api.get<ApiResponse<Order>>(`/orders/${orderNumber}`),
}
