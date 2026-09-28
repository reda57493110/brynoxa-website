import api from './client'
import type { ApiResponse } from '@/types'
import type { Locale } from '@/i18n'

export const pushApi = {
  publicKey: () => api.get<ApiResponse<{ publicKey: string | null }>>('/push/public-key'),

  subscribe: (subscription: PushSubscriptionJSON, locale: Locale) =>
    api.post<ApiResponse<null>>('/push/subscribe', { subscription, locale }),

  unsubscribe: (endpoint: string) =>
    api.post<ApiResponse<null>>('/push/unsubscribe', { endpoint }),
}
