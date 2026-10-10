import api from './client'
import type {
  ApiResponse,
  Brand,
  Category,
  ContactInboxMessage,
  Coupon,
  DashboardStats,
  NewsletterSub,
  Order,
  OrderStatus,
  Product,
  ProductFilters,
  PushCampaign,
  PushOverview,
  PushSendPayload,
  StoreSettings,
  EmailMessageEvent,
  SentEmail,
  User,
} from '@/types'

export const adminApi = {
  dashboard: () => api.get<ApiResponse<DashboardStats>>('/admin/dashboard'),

  products: {
    get: (id: string) => api.get<ApiResponse<Product>>(`/admin/products/${id}`),
    create: (payload: Partial<Product>) =>
      api.post<ApiResponse<Product>>('/admin/products', payload),
    update: (id: string, payload: Partial<Product>) =>
      api.patch<ApiResponse<Product>>(`/admin/products/${id}`, payload),
    remove: (id: string) => api.delete<ApiResponse<null>>(`/admin/products/${id}`),
    inventory: (id: string, stock: number, lowStockThreshold?: number) =>
      api.patch<ApiResponse<Product>>(`/admin/products/${id}/inventory`, {
        stock,
        ...(lowStockThreshold !== undefined ? { lowStockThreshold } : {}),
      }),
    list: (filters?: ProductFilters) =>
      api.get<ApiResponse<Product[]>>('/products', {
        params: { admin: true, ...filters, limit: filters?.limit ?? 20 },
      }),
  },

  categories: {
    create: (payload: Partial<Category>) =>
      api.post<ApiResponse<Category>>('/admin/categories', payload),
    update: (id: string, payload: Partial<Category>) =>
      api.patch<ApiResponse<Category>>(`/admin/categories/${id}`, payload),
    remove: (id: string) => api.delete<ApiResponse<null>>(`/admin/categories/${id}`),
  },

  brands: {
    create: (payload: Partial<Brand>) =>
      api.post<ApiResponse<Brand>>('/admin/brands', payload),
  },

  orders: {
    list: (params?: { page?: number; limit?: number; status?: string; q?: string }) =>
      api.get<ApiResponse<Order[]>>('/admin/orders', { params }),
    get: (id: string) => api.get<ApiResponse<Order>>(`/admin/orders/${id}`),
    updateStatus: (
      id: string,
      payload: { orderStatus: OrderStatus; adminNote?: string; note?: string }
    ) => api.patch<ApiResponse<Order>>(`/admin/orders/${id}/status`, payload),
    setDeposit: (id: string, payload: { amount?: number; received?: boolean }) =>
      api.patch<ApiResponse<Order>>(`/admin/orders/${id}/deposit`, payload),
    remove: (id: string) => api.delete<ApiResponse<null>>(`/admin/orders/${id}`),
  },

  customers: {
    list: (params?: { page?: number; limit?: number; q?: string }) =>
      api.get<ApiResponse<User[]>>('/admin/customers', { params }),
    setActive: (id: string, isActive: boolean) =>
      api.patch<ApiResponse<User>>(`/admin/customers/${id}`, { isActive }),
    remove: (id: string) => api.delete<ApiResponse<null>>(`/admin/customers/${id}`),
  },

  users: {
    list: (params?: {
      page?: number
      limit?: number
      q?: string
      role?: 'all' | 'staff' | User['role']
    }) => api.get<ApiResponse<User[]>>('/admin/users', { params }),
    create: (payload: {
      name?: string
      email: string
      password: string
      role: Exclude<User['role'], 'customer' | 'admin'>
    }) => api.post<ApiResponse<User>>('/admin/users', payload),
    setRole: (id: string, role: Exclude<User['role'], 'admin'>) =>
      api.patch<ApiResponse<User>>(`/admin/users/${id}/role`, { role }),
  },

  coupons: {
    list: () => api.get<ApiResponse<Coupon[]>>('/admin/coupons'),
    create: (payload: Partial<Coupon>) =>
      api.post<ApiResponse<Coupon>>('/admin/coupons', payload),
    update: (id: string, payload: Partial<Coupon>) =>
      api.patch<ApiResponse<Coupon>>(`/admin/coupons/${id}`, payload),
    remove: (id: string) => api.delete<ApiResponse<null>>(`/admin/coupons/${id}`),
  },

  emails: {
    list: (params?: { page?: number; limit?: number; to?: string }) =>
      api.get<ApiResponse<SentEmail[]>>('/admin/emails', { params }),
    send: (payload: { to: string; subject: string; message: string; orderId?: string }) =>
      api.post<ApiResponse<{ sentTo: string }>>('/admin/emails', payload),
  },

  messages: {
    list: (params?: { page?: number; limit?: number; status?: string }) =>
      api.get<ApiResponse<ContactInboxMessage[]>>('/admin/messages', { params }),
    update: (id: string, status: ContactInboxMessage['status']) =>
      api.patch<ApiResponse<ContactInboxMessage>>(`/admin/messages/${id}`, { status }),
  },

  subscribers: {
    list: () => api.get<ApiResponse<NewsletterSub[]>>('/admin/subscribers'),
  },

  push: {
    overview: () => api.get<ApiResponse<PushOverview>>('/admin/push'),
    send: (payload: PushSendPayload) =>
      api.post<ApiResponse<PushCampaign>>('/admin/push/send', payload),
    test: (payload: PushSendPayload) =>
      api.post<ApiResponse<{ targeted: number; delivered: number; failed: number }>>(
        '/admin/push/test',
        payload
      ),
  },

  settings: {
    update: (payload: Partial<StoreSettings>) =>
      api.patch<ApiResponse<StoreSettings>>('/settings', payload),
  },
  emailTest: (type: EmailMessageEvent) =>
    api.post<ApiResponse<{ sentTo: string }>>('/admin/email-test', { type }),
}
