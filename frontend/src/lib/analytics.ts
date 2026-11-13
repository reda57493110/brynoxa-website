type AnalyticsItem = {
  item_id: string
  item_name: string
  item_sku?: string
  price?: number
  quantity?: number
}

type EventParams = Record<string, unknown>

type PixelFn = ((...args: unknown[]) => void) & Record<string, unknown>

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    fbq?: PixelFn
    _fbq?: PixelFn
    ttq?: unknown[] & Record<string, unknown>
    TiktokAnalyticsObject?: string
  }
}

import { safePath } from './safePath'
import { hasAdConsent } from './consent'

/**
 * Shop analytics: Google Analytics 4, Meta Pixel (Facebook / Instagram ads) and TikTok Pixel.
 * The ids come from Admin → Settings → Tracking codes (configureTracking, called by the shop
 * layout once settings arrive); VITE_GA_MEASUREMENT_ID still works for Google as before.
 * Same id checks as backend/src/utils/tracking.ts — keep both in sync.
 *
 * Nothing loads before the visitor accepts measurement / ad cookies (lib/consent.ts, the cookie
 * banner): configureTracking keeps the ids and starts them on "Accept" (applyConsent).
 * Never on admin pages, and never on a page whose address carries a secret (reset / verify /
 * receipt keys): the ad platforms read the page address themselves, so nothing is sent there.
 */
const ENV_GA = (import.meta.env?.VITE_GA_MEASUREMENT_ID as string | undefined)?.trim() || ''

export const META_PIXEL_RX = /^\d{10,20}$/
export const TIKTOK_PIXEL_RX = /^[A-Z0-9]{15,30}$/
export const GA_ID_RX = /^G-[A-Z0-9]{4,16}$/

export type TrackingIds = { metaPixelId?: string; tiktokPixelId?: string; gaMeasurementId?: string }

/** The ids actually loaded on this page ('' = not loaded) */
const active = { ga: '', meta: '', tiktok: '' }
/** Last page the pixels were told about (their loaders count the first one themselves) */
let lastPixelPage = ''

const currentPath = () => `${window.location.pathname}${window.location.search}`

/** Admin pages, and addresses with a secret in them, are never shown to the ad platforms */
export function pixelsAllowedOn(pathAndQuery: string) {
  const path = pathAndQuery.split('?')[0]
  if (/(^|\/)admin(-print)?(\/|$)/.test(path)) return false
  return safePath(pathAndQuery) === pathAndQuery
}

/** Full page address for analytics, without secret values (gtag would otherwise send location.href). */
function safeLocation() {
  return `${window.location.origin}${safePath(`${window.location.pathname}${window.location.search}`)}`
}

function startGa(id: string) {
  if (active.ga || typeof window === 'undefined') return
  active.ga = id
  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args)
  }
  window.gtag('js', new Date())
  window.gtag('config', id, {
    send_page_view: false,
    anonymize_ip: true,
    page_location: safeLocation(),
  })
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${id}`
  document.head.appendChild(script)
}

/** Meta's official loader (fbevents.js), without its automatic page / button tracking */
function startMeta(id: string) {
  if (active.meta) return
  active.meta = id
  if (!window.fbq) {
    const n = function (...args: unknown[]) {
      const self = n as PixelFn
      if (typeof self.callMethod === 'function') (self.callMethod as (...a: unknown[]) => void)(...args)
      else (self.queue as unknown[]).push(args)
    } as PixelFn
    window.fbq = n
    if (!window._fbq) window._fbq = n
    n.push = n
    n.loaded = true
    n.version = '2.0'
    n.queue = []
    // Page changes are reported by the shop (cleaned), not picked up from the browser history
    n.disablePushState = true
    const s = document.createElement('script')
    s.async = true
    s.src = 'https://connect.facebook.net/en_US/fbevents.js'
    document.head.appendChild(s)
  }
  window.fbq('set', 'autoConfig', false, id)
  window.fbq('init', id)
  window.fbq('track', 'PageView')
}

/** TikTok's official loader (events.js) */
function startTikTok(id: string) {
  if (active.tiktok) return
  active.tiktok = id
  window.TiktokAnalyticsObject = 'ttq'
  const ttq = (window.ttq = window.ttq || ([] as unknown as unknown[] & Record<string, unknown>))
  const methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie', 'holdConsent', 'revokeConsent', 'grantConsent']
  const setAndDefer = (target: Record<string, unknown> & unknown[], name: string) => {
    target[name] = (...args: unknown[]) => {
      target.push([name, ...args])
    }
  }
  for (const m of methods) setAndDefer(ttq, m)
  ttq.methods = methods
  ttq.instance = (name: string) => {
    const e = ((ttq._i as Record<string, unknown[]>)?.[name] ?? []) as unknown[] & Record<string, unknown>
    for (const m of methods) setAndDefer(e, m)
    return e
  }
  ttq.load = (sdkId: string, options?: unknown) => {
    const url = 'https://analytics.tiktok.com/i18n/pixel/events.js'
    const i = (ttq._i = (ttq._i as Record<string, unknown>) || {}) as Record<string, unknown>
    const list = [] as unknown as unknown[] & Record<string, unknown>
    list._u = url
    i[sdkId] = list
    ;(ttq._t = (ttq._t as Record<string, number>) || {})
    ;(ttq._t as Record<string, number>)[sdkId] = Date.now()
    ;(ttq._o = (ttq._o as Record<string, unknown>) || {})
    ;(ttq._o as Record<string, unknown>)[sdkId] = options || {}
    const s = document.createElement('script')
    s.type = 'text/javascript'
    s.async = true
    s.src = `${url}?sdkid=${sdkId}&lib=ttq`
    document.head.appendChild(s)
  }
  ;(ttq.load as (id: string) => void)(id)
  ;(ttq.page as () => void)()
}

/** Load GA4 when VITE_GA_MEASUREMENT_ID is set (before settings arrive). Safe no-op otherwise. */
export function initAnalytics() {
  if (typeof window === 'undefined' || !ENV_GA) return
  // Not on admin pages (staff visits are not shop traffic)
  if (/(^|\/)admin(-print)?(\/|$)/.test(window.location.pathname)) return
  if (!hasAdConsent()) return
  startGa(ENV_GA)
}

/** The ids saved in Admin → Settings → Tracking codes (bad ids are ignored) */
export function cleanTrackingIds(t?: TrackingIds | null) {
  const meta = String(t?.metaPixelId ?? '').trim()
  const tiktok = String(t?.tiktokPixelId ?? '').trim().toUpperCase()
  const ga = String(t?.gaMeasurementId ?? '').trim().toUpperCase()
  return {
    meta: META_PIXEL_RX.test(meta) ? meta : '',
    tiktok: TIKTOK_PIXEL_RX.test(tiktok) ? tiktok : '',
    ga: GA_ID_RX.test(ga) ? ga : '',
  }
}

/** Shop layout: starts what is configured (once each; a changed id is used from the next visit) */
/** Ids waiting for the visitor's consent */
let pendingIds: TrackingIds | null = null

/** True when something would be loaded after consent (the banner is only shown then) */
export function trackingWanted(t?: TrackingIds | null) {
  const ids = cleanTrackingIds(t)
  return Boolean(ids.meta || ids.tiktok || ids.ga || ENV_GA)
}

/** Cookie banner "Accept": starts what the shop has configured */
export function applyConsent() {
  configureTracking(pendingIds)
}

export function configureTracking(t?: TrackingIds | null) {
  if (typeof window === 'undefined') return
  pendingIds = t ?? pendingIds
  if (!hasAdConsent()) return
  const path = currentPath()
  if (!pixelsAllowedOn(path)) return
  const ids = cleanTrackingIds(t)
  const ga = ids.ga || ENV_GA
  if (ga && !active.ga) {
    startGa(ga)
    emit('page_view', { page_path: safePath(path), page_title: document.title })
  }
  if (ids.meta && !active.meta) {
    lastPixelPage = path
    startMeta(ids.meta)
  }
  if (ids.tiktok && !active.tiktok) {
    lastPixelPage = path
    startTikTok(ids.tiktok)
  }
}

const fb = (event: string, data?: EventParams, options?: EventParams) => {
  if (active.meta && typeof window.fbq === 'function') window.fbq('track', event, data ?? {}, options ?? {})
}
const tt = (event: string, data?: EventParams, options?: EventParams) => {
  const track = window.ttq?.track
  if (active.tiktok && typeof track === 'function') (track as (...a: unknown[]) => void)(event, data ?? {}, options ?? {})
}

/** The same shop events in Meta's and TikTok's standard names */
function toPixels(event: string, params: EventParams = {}) {
  if (!active.meta && !active.tiktok) return
  const path = currentPath()
  if (!pixelsAllowedOn(path)) return
  const items = (params.items as AnalyticsItem[] | undefined) ?? []
  const value = typeof params.value === 'number' ? params.value : undefined
  const meta = { currency: 'MAD', value, content_type: 'product', content_ids: items.map((i) => i.item_id), num_items: items.reduce((a, i) => a + (i.quantity ?? 1), 0) || undefined }
  const tiktok = {
    currency: 'MAD',
    value,
    content_type: 'product',
    contents: items.map((i) => ({ content_id: i.item_id, content_name: i.item_name, price: i.price, quantity: i.quantity ?? 1 })),
  }
  switch (event) {
    case 'page_view':
      if (path === lastPixelPage) return
      lastPixelPage = path
      if (active.meta && typeof window.fbq === 'function') window.fbq('track', 'PageView')
      if (active.tiktok && typeof window.ttq?.page === 'function') (window.ttq.page as () => void)()
      return
    case 'view_item':
      fb('ViewContent', { ...meta, content_name: items[0]?.item_name })
      tt('ViewContent', tiktok)
      return
    case 'add_to_cart':
      fb('AddToCart', meta)
      tt('AddToCart', tiktok)
      return
    case 'begin_checkout':
      fb('InitiateCheckout', meta)
      tt('InitiateCheckout', tiktok)
      return
    case 'purchase': {
      // The order number lets the platforms drop a duplicate of the same order
      const id = String(params.transaction_id ?? '')
      fb('Purchase', meta, id ? { eventID: id } : undefined)
      tt('PlaceAnOrder', tiktok, id ? { event_id: id } : undefined)
      return
    }
    case 'search':
      fb('Search', { search_string: params.search_term })
      tt('Search', { query: params.search_term })
      return
    case 'whatsapp_click':
      if (params.stage === 'send') {
        fb('Contact')
        tt('Contact')
      }
      return
  }
}

function emit(event: string, params?: EventParams) {
  if (import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.debug('[analytics]', event, params || {})
  }
  toPixels(event, params)
  if (!active.ga || typeof window.gtag !== 'function') return
  // Every event carries the page address: always the cleaned one
  window.gtag('event', event, { page_location: safeLocation(), ...params })
}

export function trackPageView(path: string, title?: string) {
  emit('page_view', {
    page_path: safePath(path),
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
