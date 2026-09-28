import api from './client'
import type { ApiResponse } from '@/types'
import type { Locale } from '@/i18n'

/** Order number + receipt token: proves the browser belongs to that order's customer. */
export type PushOrderLink = { orderNumber: string; token: string }

export const pushApi = {
  publicKey: () => api.get<ApiResponse<{ publicKey: string | null }>>('/push/public-key'),

  subscribe: (subscription: PushSubscriptionJSON, locale: Locale, order?: PushOrderLink) =>
    api.post<ApiResponse<null>>('/push/subscribe', { subscription, locale, order }),

  unsubscribe: (endpoint: string) =>
    api.post<ApiResponse<null>>('/push/unsubscribe', { endpoint }),
}
