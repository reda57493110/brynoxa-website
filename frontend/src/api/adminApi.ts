import api from './client'
import type {
  ApiResponse,
  Brand,
  Category,
  Coupon,
  DashboardStats,
  Order,
  OrderStatus,
  Product,
  ProductFilters,
  Review,
  StoreSettings,
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
    inventory: (id: string, stock: number) =>
      api.patch<ApiResponse<Product>>(`/admin/products/${id}/inventory`, { stock }),
    list: (filters?: ProductFilters) =>
      api.get<ApiResponse<Product[]>>('/products', {
        params: { ...filters, limit: filters?.limit ?? 50 },
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
    update: (id: string, payload: Partial<Brand>) =>
      api.patch<ApiResponse<Brand>>(`/admin/brands/${id}`, payload),
    remove: (id: string) => api.delete<ApiResponse<null>>(`/admin/brands/${id}`),
  },

  orders: {
    list: (params?: { page?: number; limit?: number; status?: string }) =>
      api.get<ApiResponse<Order[]>>('/admin/orders', { params }),
    get: (id: string) => api.get<ApiResponse<Order>>(`/admin/orders/${id}`),
    updateStatus: (
      id: string,
      payload: { orderStatus: OrderStatus; adminNote?: string; note?: string }
    ) => api.patch<ApiResponse<Order>>(`/admin/orders/${id}/status`, payload),
  },

  customers: {
    list: (params?: { page?: number; limit?: number }) =>
      api.get<ApiResponse<User[]>>('/admin/customers', { params }),
    setActive: (id: string, isActive: boolean) =>
      api.patch<ApiResponse<User>>(`/admin/customers/${id}`, { isActive }),
  },

  reviews: {
    list: (params?: { page?: number; limit?: number }) =>
      api.get<ApiResponse<Review[]>>('/admin/reviews', { params }),
    moderate: (id: string, isApproved: boolean) =>
      api.patch<ApiResponse<Review>>(`/admin/reviews/${id}`, { isApproved }),
    remove: (id: string) => api.delete<ApiResponse<null>>(`/admin/reviews/${id}`),
  },

  coupons: {
    list: () => api.get<ApiResponse<Coupon[]>>('/admin/coupons'),
    create: (payload: Partial<Coupon>) =>
      api.post<ApiResponse<Coupon>>('/admin/coupons', payload),
    update: (id: string, payload: Partial<Coupon>) =>
      api.patch<ApiResponse<Coupon>>(`/admin/coupons/${id}`, payload),
    remove: (id: string) => api.delete<ApiResponse<null>>(`/admin/coupons/${id}`),
  },

  settings: {
    update: (payload: Partial<StoreSettings>) =>
      api.patch<ApiResponse<StoreSettings>>('/admin/settings', payload),
  },
}
