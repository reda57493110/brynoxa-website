import { pushApi } from '@/api/pushApi'
import type { Locale } from '@/i18n'

const DISMISSED_KEY = 'brynoxa-push-dismissed-at'
const VIEWS_KEY = 'brynoxa-push-product-views'
const SYNCED_LOCALE_KEY = 'brynoxa-push-locale'
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000
const PRODUCT_VIEWS_BEFORE_PROMPT = 2

export const PUSH_ENGAGED_EVENT = 'brynoxa:push-engaged'
export const PUSH_STATUS_EVENT = 'brynoxa:push-status'

export function announcePushStatus() {
  window.dispatchEvent(new Event(PUSH_STATUS_EVENT))
}

function rememberSyncedLocale(locale: Locale | null) {
  try {
    if (locale) localStorage.setItem(SYNCED_LOCALE_KEY, locale)
    else localStorage.removeItem(SYNCED_LOCALE_KEY)
  } catch {
    /* storage unavailable */
  }
}

export type PushStatus = 'unsupported' | 'denied' | 'subscribed' | 'available'

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/')
  if (existing) return existing
  return navigator.serviceWorker.register('/sw.js', { scope: '/' })
}

let publicKeyPromise: Promise<string | null> | null = null

function fetchPublicKey(): Promise<string | null> {
  if (!publicKeyPromise) {
    publicKeyPromise = pushApi
      .publicKey()
      .then((res) => res.data.data.publicKey || null)
      .catch(() => {
        publicKeyPromise = null
        return null
      })
  }
  return publicKeyPromise
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission === 'granted') {
    const registration = await navigator.serviceWorker.getRegistration('/')
    const subscription = await registration?.pushManager.getSubscription()
    if (subscription) return 'subscribed'
  }
  return (await fetchPublicKey()) ? 'available' : 'unsupported'
}

function base64UrlToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/** Shows the native browser prompt — call only from a user click. */
export async function subscribeToPush(locale: Locale): Promise<PushStatus> {
  if (!isPushSupported()) return 'unsupported'

  const permission = await Notification.requestPermission()
  if (permission === 'denied') return 'denied'
  if (permission !== 'granted') return 'available'

  const publicKey = await fetchPublicKey()
  if (!publicKey) throw new Error('Notifications are not available right now')

  const registration = await getRegistration()
  await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(publicKey),
    })
  }

  await pushApi.subscribe(subscription.toJSON(), locale)
  rememberSyncedLocale(locale)
  return 'subscribed'
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return
  const registration = await navigator.serviceWorker.getRegistration('/')
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  await pushApi.unsubscribe(subscription.endpoint).catch(() => undefined)
  await subscription.unsubscribe()
  rememberSyncedLocale(null)
}

/** Re-sends the subscription when the shopper switches language. */
export async function syncPushLocale(locale: Locale): Promise<void> {
  if (!isPushSupported() || Notification.permission !== 'granted') return
  try {
    if (localStorage.getItem(SYNCED_LOCALE_KEY) === locale) return
  } catch {
    return
  }
  const registration = await navigator.serviceWorker.getRegistration('/')
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  await pushApi.subscribe(subscription.toJSON(), locale)
  rememberSyncedLocale(locale)
}

export function dismissPushPrompt() {
  try {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()))
  } catch {
    /* storage unavailable */
  }
}

export function isPushPromptSnoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY) || 0)
    return Date.now() - at < DISMISS_COOLDOWN_MS
  } catch {
    return true
  }
}

function signalEngaged() {
  window.dispatchEvent(new Event(PUSH_ENGAGED_EVENT))
}

export function hasEngagedEnough(): boolean {
  try {
    return Number(sessionStorage.getItem(VIEWS_KEY) || 0) >= PRODUCT_VIEWS_BEFORE_PROMPT
  } catch {
    return false
  }
}

export function recordProductView() {
  try {
    const views = Number(sessionStorage.getItem(VIEWS_KEY) || 0) + 1
    sessionStorage.setItem(VIEWS_KEY, String(views))
    if (views >= PRODUCT_VIEWS_BEFORE_PROMPT) signalEngaged()
  } catch {
    /* storage unavailable */
  }
}

export function recordAddToCart() {
  try {
    sessionStorage.setItem(VIEWS_KEY, String(PRODUCT_VIEWS_BEFORE_PROMPT))
  } catch {
    /* storage unavailable */
  }
  signalEngaged()
}
