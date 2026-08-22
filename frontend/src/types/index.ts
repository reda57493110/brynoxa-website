export interface ApiMeta {
  page: number
  limit: number
  total: number
  pages: number
}

export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
  meta?: ApiMeta
}

export interface Address {
  _id?: string
  label: string
  fullName: string
  line1: string
  line2?: string
  city: string
  state?: string
  postalCode?: string
  country?: string
  phone: string
  isDefault?: boolean
}

export interface User {
  _id: string
  name: string
  email: string
  role: 'customer' | 'admin' | 'orders' | 'catalog' | 'support' | 'marketing'
  phone?: string
  addresses: Address[]
  avatar?: string
  isActive: boolean
  isGuest?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface AuthPayload {
  user: User
  accessToken: string
}

export interface SessionPayload {
  user: User | null
  accessToken: string | null
}

export interface Category {
  _id: string
  name: string
  slug: string
  description?: string
  image?: string
  parent?: string | Category | null
  isActive: boolean
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

export interface Brand {
  _id: string
  name: string
  slug: string
  logo?: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface ProductImage {
  url: string
  publicId?: string
  alt?: string
  isPrimary?: boolean
}

export interface Product {
  _id: string
  name: string
  slug: string
  sku: string
  description: string
  shortDescription?: string
  category: Category | string
  brand: Brand | string
  images: ProductImage[]
  price: number
  compareAtPrice?: number
  stock: number
  lowStockThreshold: number
  specs: Record<string, string>
  tags: string[]
  isFeatured: boolean
  isCarousel?: boolean
  isActive: boolean
  averageRating: number
  reviewCount: number
  soldCount: number
  createdAt?: string
  updatedAt?: string
}

export interface ProductFilters {
  page?: number
  limit?: number
  sort?: string
  q?: string
  category?: string
  brand?: string
  minPrice?: number
  maxPrice?: number
  featured?: boolean
  carousel?: boolean
  inStock?: boolean
  isActive?: boolean
  admin?: boolean
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

export interface OrderItem {
  product: string | Product
  name: string
  image?: string
  sku: string
  price: number
  qty: number
}

export interface OrderTimeline {
  status: OrderStatus
  note?: string
  at: string
}

export interface OrderPricing {
  subtotal: number
  discount: number
  shipping: number
  tax: number
  total: number
}

export interface Order {
  _id: string
  orderNumber: string
  user: User | string
  items: OrderItem[]
  pricing: OrderPricing
  coupon?: { code: string; couponId?: string }
  shippingAddress: Address
  paymentMethod: 'cod'
  paymentStatus: PaymentStatus
  orderStatus: OrderStatus
  timeline: OrderTimeline[]
  customerNote?: string
  adminNote?: string
  stockReserved?: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateOrderPayload {
  items: { productId: string; qty: number }[]
  shippingAddress: Omit<Address, '_id' | 'isDefault'> & { isDefault?: boolean }
  couponCode?: string
  customerNote?: string
  email?: string
  password?: string
}

export interface CreateOrderResult {
  order: Order
  user?: User
  accessToken?: string
}

export interface Review {
  _id: string
  product: Product | string
  user: User | string
  rating: number
  title: string
  comment: string
  isApproved: boolean
  createdAt: string
  updatedAt?: string
}

export interface Coupon {
  _id: string
  code: string
  type: 'percent' | 'fixed'
  value: number
  minOrder: number
  maxUses: number
  usedCount: number
  startsAt?: string
  expiresAt?: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface CouponValidation {
  valid?: boolean
  discount: number
  code?: string
  coupon?: Coupon
  message?: string
}

export interface WishlistDoc {
  _id: string
  user: string
  products: Product[]
}

export interface NotificationsPayload {
  items: Notification[]
  unread: number
}

export interface StoreSettings {
  _id?: string
  storeName: string
  currency: string
  shippingFlatRate: number
  freeShippingMin: number
  taxRate: number
  supportEmail: string
  codEnabled: boolean
}

export interface Notification {
  _id: string
  user: string
  type: string
  title: string
  message: string
  link?: string
  isRead: boolean
  createdAt: string
}

export interface DashboardStats {
  revenue: number
  todayRevenue: number
  todayOrders: number
  avgOrderValue: number
  orderCount: number
  pendingOrders: number
  customerCount: number
  productCount: number
  lowStock: number
  reviewCount: number
  unreadMessages: number
  recentOrders: Order[]
  salesByDay: { _id: string; revenue: number; orders: number }[]
  ordersByStatus: Record<string, number>
  lowStockProducts: Pick<Product, '_id' | 'name' | 'sku' | 'stock' | 'slug' | 'images'>[]
}

export interface ContactInboxMessage {
  _id: string
  name: string
  email: string
  subject: string
  message: string
  status: 'new' | 'read' | 'archived'
  createdAt: string
}

export interface NewsletterSub {
  _id: string
  email: string
  isActive: boolean
  createdAt: string
}

export interface CartItem {
  productId: string
  slug: string
  name: string
  image?: string
  price: number
  qty: number
  stock: number
  sku: string
}

export interface UploadResult {
  url: string
  publicId?: string
}
