type AnalyticsItem = {
  item_id: string
  item_name: string
  item_sku?: string
  price?: number
  quantity?: number
}

type EventParams = Record<string, unknown>

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const MEASUREMENT_ID = (import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined)?.trim()

let initialized = false

export function isAnalyticsEnabled() {
  return Boolean(MEASUREMENT_ID)
}

/** Load GA4 gtag when VITE_GA_MEASUREMENT_ID is set. Safe no-op otherwise. */
export function initAnalytics() {
  if (initialized || typeof window === 'undefined' || !MEASUREMENT_ID) return
  initialized = true

  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args)
  }
  window.gtag('js', new Date())
  window.gtag('config', MEASUREMENT_ID, {
    send_page_view: false,
    anonymize_ip: true,
  })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`
  document.head.appendChild(script)
}

function emit(event: string, params?: EventParams) {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[analytics]', event, params || {})
  }
  if (!MEASUREMENT_ID || typeof window.gtag !== 'function') return
  window.gtag('event', event, params)
}

export function trackPageView(path: string, title?: string) {
  emit('page_view', {
    page_path: path,
    page_title: title || document.title,
  })
}

export function trackViewItem(item: AnalyticsItem) {
  emit('view_item', {
    currency: 'MAD',
    value: item.price,
    items: [item],
  })
}

export function trackAddToCart(item: AnalyticsItem) {
  emit('add_to_cart', {
    currency: 'MAD',
    value: (item.price || 0) * (item.quantity || 1),
    items: [item],
  })
}

export function trackBeginCheckout(items: AnalyticsItem[], value: number) {
  emit('begin_checkout', {
    currency: 'MAD',
    value,
    items,
  })
}

export function trackPurchase(input: {
  transactionId: string
  value: number
  items: AnalyticsItem[]
  coupon?: string
}) {
  emit('purchase', {
    transaction_id: input.transactionId,
    currency: 'MAD',
    value: input.value,
    coupon: input.coupon,
    items: input.items,
  })
}

export function trackWhatsApp(input: {
  topic?: string | null
  productName?: string
  stage: 'open' | 'send'
}) {
  emit('whatsapp_click', {
    topic: input.topic || 'general',
    product_name: input.productName || undefined,
    stage: input.stage,
  })
}

export function trackSearch(query: string) {
  if (!query.trim()) return
  emit('search', { search_term: query.trim() })
}
