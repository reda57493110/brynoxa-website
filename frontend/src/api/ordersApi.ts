import api from './client'
import type { ApiResponse, CreateOrderPayload, CreateOrderResult, Order } from '@/types'

export const ordersApi = {
  create: (payload: CreateOrderPayload) =>
    api.post<ApiResponse<CreateOrderResult>>('/orders', payload),

  list: (params?: { page?: number; limit?: number }) =>
    api.get<ApiResponse<Order[]>>('/orders', { params }),

  getByNumber: (orderNumber: string) =>
    api.get<ApiResponse<Order>>(`/orders/${orderNumber}`),

  getGuestReceipt: (orderNumber: string, token: string) =>
    api.post<ApiResponse<Order>>(`/orders/${orderNumber}/receipt`, { token }),

  track: (orderNumber: string, phone: string) =>
    api.post<ApiResponse<Order>>('/orders/track', { orderNumber, phone }),

  cancel: (orderNumber: string) =>
    api.post<ApiResponse<Order>>(`/orders/${orderNumber}/cancel`),

  reportDeposit: (
    orderNumber: string,
    payload: {
      methodId: string
      payerName?: string
      senderPhone?: string
      paidOn?: string
      amountSent?: number
      fee?: number
      place?: string
      codes?: { label: string; value: string }[]
      reference?: string
      note?: string
      receipt?: string
    }
  ) => api.post<ApiResponse<Order>>(`/orders/${orderNumber}/deposit-payment`, payload),

  depositProofImage: (orderNumber: string, proofId: string) =>
    api.get<Blob>(`/orders/${orderNumber}/deposit-proofs/${proofId}`, { responseType: 'blob' }),

  updateItems: (orderNumber: string, items: { productId: string; qty: number }[]) =>
    api.patch<ApiResponse<Order>>(`/orders/${orderNumber}/items`, { items }),
}
