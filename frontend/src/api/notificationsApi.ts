import api from './client'
import type { ApiResponse, Notification, NotificationsPayload } from '@/types'

export const notificationsApi = {
  list: () => api.get<ApiResponse<NotificationsPayload>>('/notifications'),
  markRead: (id: string) =>
    api.patch<ApiResponse<Notification>>(`/notifications/${id}/read`),
  markAllRead: () => api.post<ApiResponse<Notification[]>>('/notifications/read-all'),
}
