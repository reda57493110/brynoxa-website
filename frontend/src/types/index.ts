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
  mfaEnabled?: boolean
  customerType?: CustomerType
  wholesaleStatus?: WholesaleStatus
  createdAt?: string
  updatedAt?: string
}

export type CustomerType = 'retail' | 'wholesale' | 'business'
export type WholesaleStatus = 'none' | 'pending' | 'approved' | 'rejected'

export interface AuthPayload {
  user?: User
  accessToken?: string
  mfaRequired?: boolean
  mfaToken?: string
  verificationRequired?: boolean
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

/** Optional upfront deposit for COD: fixed DH per unit, or % of the line price. */
export interface ProductDeposit {
  type: 'fixed' | 'percent'
  value: number
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
  /** Staff-only; only present in admin product responses */
  costPrice?: number | null
  deposit?: ProductDeposit | null
  /** Hand-picked recommendations (ids; populated objects in the admin product view) */
  recommended?: (string | Product)[]
  recommendedOnly?: boolean
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

/** Paid before the order is confirmed; the rest of the total is paid on delivery. */
export interface OrderDeposit {
  amount: number
  source: 'products' | 'admin'
  status: 'pending' | 'received'
  receivedAt?: string
}

export interface OrderItem {
  product: string | Product
  name: string
  image?: string
  sku: string
  /** Charged per unit (after any wholesale discount) */
  price: number
  qty: number
  /** Catalog price per unit when ordered */
  listPrice?: number
}

export interface OrderRefund {
  amount: number
  reason: string
  itemsReturned?: boolean
  at: string
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
  channel?: 'retail' | 'wholesale'
  wholesaleTier?: { id: string; name: string; discountPercent: number }
  refunds?: OrderRefund[]
  deposit?: OrderDeposit
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
  receiptToken?: string
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
  shippingByCity?: { city: string; rate: number }[]
  taxRate: number
  supportEmail: string
  codEnabled: boolean
  depositInstructions?: string
  emailNotifications?: Partial<Record<EmailEvent, boolean>>
  emailMessages?: Partial<Record<EmailMessageEvent, string>>
  wholesaleTiers?: WholesaleTier[]
  customerSegments?: SegmentSettings
  notifyStaffLoginEmail?: boolean
  pageHeroProducts?: Partial<Record<HeroPage, string>>
}

export type HeroPage = 'shop' | 'services' | 'contact'

/** Automatic emails the admin can switch on/off (mirrors backend EMAIL_EVENTS). */
export type EmailEvent =
  | 'orderPlaced'
  | 'orderConfirmed'
  | 'orderShipped'
  | 'orderDelivered'
  | 'orderCancelled'
  | 'depositRequested'
  | 'depositReceived'
  | 'staffNewOrder'
  | 'securityAlerts'

/** Customer emails that can carry a custom message and be test-sent. */
export type EmailMessageEvent = Exclude<EmailEvent, 'staffNewOrder' | 'securityAlerts'>

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

export type PushTranslations = Partial<Record<'en' | 'fr' | 'ar', { title: string; body: string }>>

export interface PushCampaign {
  _id: string
  title: string
  body: string
  translations?: PushTranslations
  url?: string
  image?: string
  sentByName?: string
  targeted: number
  delivered: number
  failed: number
  removed: number
  clicks?: number
  createdAt: string
}

export interface PushSendPayload {
  title: string
  body: string
  url?: string
  image?: string
  translations?: PushTranslations
}

export interface PushOverview {
  configured: boolean
  subscribers: number
  myDevices: number
  byLocale: Partial<Record<'en' | 'fr' | 'ar', number>>
  campaigns: PushCampaign[]
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

/** An email written by staff from the admin Emails page. */
export interface SentEmail {
  _id: string
  to: string
  subject: string
  message: string
  order?: string
  orderNumber?: string
  sentBy?: { _id: string; name?: string; email?: string } | string
  status: 'sent' | 'failed'
  createdAt: string
}

/* ---------- Customer management (admin) ---------- */

export interface WholesaleTier {
  id: string
  name: string
  discountPercent: number
}

export interface SavedSegment {
  id: string
  name: string
  filters: Record<string, string | number>
}

export interface SegmentSettings {
  newDays: number
  inactiveDays: number
  highSpendMin: number
  highProfitMin: number
  saved: SavedSegment[]
}

export type SegmentKey =
  | 'new'
  | 'repeat'
  | 'high-spend'
  | 'high-profit'
  | 'inactive'
  | 'wholesale'
  | 'wholesale-pending'
  | 'outstanding'

export type CustomerAccountStatus = 'active' | 'disabled' | 'unverified' | 'wholesale-pending'

/** Sales figures for a set of orders. Profit fields are null when cost data is missing or hidden. */
export interface SalesBlock {
  orders: number
  completedOrders: number
  grossSales: number
  wholesaleDiscounts: number
  couponDiscounts: number
  refunds: number
  netSales: number
  cogs: number
  ordersMissingCost: number
  grossProfit: number | null
  margin: number | null
  averageOrderValue: number | null
  profitPerOrder: number | null
}

export interface CustomerMetrics {
  orders: { total: number; completed: number; open: number; cancelled: number; refunded: number; partiallyRefunded: number }
  sales: SalesBlock & { totalOrderValue: number; completedOrderValue: number; shippingCollected: number }
  channels: { retail: SalesBlock; wholesale: SalesBlock }
  payments: {
    totalPaid: number
    depositsReceived: number
    depositsAwaiting: number
    dueOnDelivery: number
    toCollect: number
    refunds: number
    codOrders: number
    methods: string[]
  }
  dates: { firstOrder: string | null; lastOrder: string | null; lastCompleted: string | null }
  /** False when the viewer lacks the "reports" permission (cost/profit removed). */
  profitVisible: boolean
}

export interface CustomerRow {
  _id: string
  customerId: string
  name: string
  email: string
  phone?: string
  companyName?: string
  customerType: CustomerType
  status: CustomerAccountStatus
  wholesaleStatus: WholesaleStatus
  tierName?: string
  isGuest: boolean
  registeredAt: string
  segments: SegmentKey[]
  metrics: CustomerMetrics
}

export interface CustomerListParams {
  page?: number
  limit?: number
  q?: string
  type?: CustomerType | ''
  status?: CustomerAccountStatus | ''
  registeredFrom?: string
  registeredTo?: string
  from?: string
  to?: string
  activity?: 'ordered' | 'never' | 'active' | 'inactive' | ''
  minOrders?: number | string
  maxOrders?: number | string
  minNet?: number | string
  maxNet?: number | string
  minProfit?: number | string
  segment?: string
  sort?: 'spent' | 'net' | 'profit' | 'orders' | 'lastOrder' | 'registered' | 'name'
  dir?: 'asc' | 'desc'
}

export interface SummaryBlock {
  netSales: number
  grossProfit: number | null
  ordersMissingCost: number
  averageOrderValue: number | null
  completedOrders: number
  toCollect: number
  profitVisible: boolean
}

export interface CustomerSummary {
  counts: {
    total: number
    active: number
    retail: number
    wholesaleApproved: number
    wholesalePending: number
    newInPeriod: number | null
  }
  lifetime: SummaryBlock
  period: SummaryBlock | null
  segmentSettings: SegmentSettings
  wholesaleTiers: WholesaleTier[]
}

export interface BusinessInfo {
  companyName?: string
  contactName?: string
  email?: string
  phone?: string
  address?: string
  taxId?: string
}

export interface BillingAddress {
  fullName?: string
  line1?: string
  line2?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  phone?: string
}

export interface CustomerTimelineEvent {
  at: string
  type: string
  title: string
  detail?: string
  orderId?: string
  orderNumber?: string
}

export interface CustomerProfileOrder {
  _id: string
  orderNumber: string
  createdAt: string
  orderStatus: OrderStatus
  paymentStatus: PaymentStatus
  channel: 'retail' | 'wholesale'
  tierName?: string
  items: number
  total: number
  discount: number
  deposit: { amount: number; status: 'pending' | 'received' } | null
  refunded: number
  fullyRefunded: boolean
  completed: boolean
}

export interface CustomerProfile {
  customer: {
    _id: string
    customerId: string
    name: string
    email: string
    phone?: string
    emailVerified?: boolean
    isActive: boolean
    isGuest?: boolean
    createdAt: string
    customerType?: CustomerType
    status: CustomerAccountStatus
    addresses: Address[]
    billingAddress?: BillingAddress
    business?: BusinessInfo
    adminNotes?: string
    wholesale?: {
      status: WholesaleStatus
      requestedType?: 'wholesale' | 'business'
      applicationMessage?: string
      requestedAt?: string
      reviewedAt?: string
      reviewedBy?: { name?: string } | string
      rejectionReason?: string
      tierId?: string
      paymentTerms?: string
    }
    tier: WholesaleTier | null
    segments: SegmentKey[]
    daysInactive: number
    inactive: boolean
    inactiveDays: number
  }
  lifetime: CustomerMetrics
  period: CustomerMetrics | null
  orders: CustomerProfileOrder[]
  refunds: (OrderRefund & { orderId: string; orderNumber: string })[]
  topProducts: { productId: string; name: string; qty: number; orders: number; spent: number; slug?: string }[]
  categories: { name: string; qty: number; spent: number }[]
  timeline: CustomerTimelineEvent[]
  wholesaleTiers: WholesaleTier[]
}

export interface CustomerUpdatePayload {
  name?: string
  phone?: string
  isActive?: boolean
  customerType?: CustomerType
  adminNotes?: string
  business?: BusinessInfo
  billingAddress?: BillingAddress | null
  tierId?: string
  paymentTerms?: string
}

export interface WholesaleReviewPayload {
  action: 'approve' | 'reject' | 'revoke'
  tierId?: string
  paymentTerms?: string
  reason?: string
  customerType?: 'wholesale' | 'business'
}

/** What a signed-in customer sees about their own wholesale account. */
export interface MyWholesale {
  customerType: CustomerType
  status: WholesaleStatus
  requestedType?: 'wholesale' | 'business'
  requestedAt?: string
  rejectionReason?: string
  paymentTerms?: string
  business?: BusinessInfo
  terms: WholesaleTerms | null
}

export interface WholesaleTerms {
  tierId: string
  tierName: string
  discountPercent: number
}

export interface WholesaleApplicationPayload {
  requestedType: 'wholesale' | 'business'
  business: BusinessInfo & { companyName: string; phone: string }
  message?: string
}
