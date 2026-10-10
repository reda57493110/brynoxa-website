import api from './client'
import type {
  ProductVariant,
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
  CustomerListParams,
  CustomerProfile,
  CustomerRow,
  CustomerSummary,
  CustomerUpdatePayload,
  WholesaleReviewPayload,
  SentEmail,
  User,
} from '@/types'

/** Drops empty filter values so they are not sent as "?type=". */
function cleanParams<T extends object>(params?: T) {
  if (!params) return undefined
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
}

export const adminApi = {
  dashboard: () => api.get<ApiResponse<DashboardStats>>('/admin/dashboard'),

  products: {
    get: (id: string) => api.get<ApiResponse<Product>>(`/admin/products/${id}`),
    create: (payload: Partial<Product>) =>
      api.post<ApiResponse<Product>>('/admin/products', payload),
    update: (id: string, payload: Partial<Product>) =>
      api.patch<ApiResponse<Product>>(`/admin/products/${id}`, payload),
    remove: (id: string) => api.delete<ApiResponse<null>>(`/admin/products/${id}`),
    /** Low-stock threshold, and/or a new sellable count (logged adjustment: reason + approval rights). */
    inventory: (id: string, payload: { stock?: number; lowStockThreshold?: number; reason?: string }) =>
      api.patch<ApiResponse<Product>>(`/admin/products/${id}/inventory`, payload),
    /** Variants: copy this product as a new option, or link an existing product (productId). */
    addVariant: (id: string, payload: { attributes?: string[]; productId?: string }) =>
      api.post<ApiResponse<Product>>(`/admin/products/${id}/variants`, payload),
    updateVariants: (id: string, payload: { attributes?: string[]; labels?: Record<string, string> }) =>
      api.patch<ApiResponse<ProductVariant[]>>(`/admin/products/${id}/variants`, payload),
    leaveVariants: (id: string) => api.delete<ApiResponse<null>>(`/admin/products/${id}/variants`),
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
    recordRefund: (id: string, payload: { amount: number; reason: string; itemsReturned?: boolean }) =>
      api.post<ApiResponse<Order>>(`/admin/orders/${id}/refunds`, payload),
    remove: (id: string) => api.delete<ApiResponse<null>>(`/admin/orders/${id}`),
  },

  customers: {
    list: (params?: CustomerListParams) =>
      api.get<ApiResponse<CustomerRow[]>>('/admin/customers', { params: cleanParams(params) }),
    summary: (params?: { from?: string; to?: string }) =>
      api.get<ApiResponse<CustomerSummary>>('/admin/customers/summary', { params: cleanParams(params) }),
    /** CSV of the filtered list (downloaded with the staff session). */
    exportCsv: (params?: CustomerListParams) =>
      api.get<Blob>('/admin/customers/export', { params: cleanParams(params), responseType: 'blob' }),
    profile: (id: string, params?: { from?: string; to?: string }) =>
      api.get<ApiResponse<CustomerProfile>>(`/admin/customers/${id}`, { params: cleanParams(params) }),
    update: (id: string, payload: CustomerUpdatePayload) =>
      api.patch<ApiResponse<CustomerProfile>>(`/admin/customers/${id}`, payload),
    setActive: (id: string, isActive: boolean) =>
      api.patch<ApiResponse<CustomerProfile>>(`/admin/customers/${id}`, { isActive }),
    reviewWholesale: (id: string, payload: WholesaleReviewPayload) =>
      api.post<ApiResponse<CustomerProfile>>(`/admin/customers/${id}/wholesale`, payload),
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
    /** Full settings incl. private fields (tiers, segments, email config). */
    get: () => api.get<ApiResponse<StoreSettings>>('/admin/settings'),
    update: (payload: Partial<StoreSettings>) =>
      api.patch<ApiResponse<StoreSettings>>('/settings', payload),
  },
  emailTest: (type: EmailMessageEvent) =>
    api.post<ApiResponse<{ sentTo: string }>>('/admin/email-test', { type }),
}
