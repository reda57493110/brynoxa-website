/**
 * The visitor's choice about measurement / advertising cookies (Google Analytics, Meta Pixel,
 * TikTok Pixel). Nothing of theirs loads before "Accept" (lib/analytics.ts asks hasAdConsent()).
 * Kept on this device; "Cookie settings" in the footer asks again (openConsent).
 */
export type ConsentChoice = 'granted' | 'denied'

const KEY = 'brx-consent'
/** Raised when the policy changes in a way that needs asking again */
const VERSION = 1
const OPEN_EVENT = 'brx-consent-open'
const CHANGE_EVENT = 'brx-consent-change'

export function readConsent(): ConsentChoice | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { choice?: string; v?: number }
    if (v.v !== VERSION) return null
    return v.choice === 'granted' || v.choice === 'denied' ? v.choice : null
  } catch {
    return null
  }
}

export const hasAdConsent = () => readConsent() === 'granted'

/** Cookies the measurement / ad scripts leave behind (removed when the visitor refuses later) */
const TRACKING_COOKIE = /^(_ga|_gid|_gat|_gcl|_fbp|_fbc|_ttp|_tt_|ttcsid)/

function clearTrackingCookies() {
  if (typeof document === 'undefined') return
  const host = window.location.hostname
  const domains = ['', host, `.${host}`, `.${host.split('.').slice(-2).join('.')}`]
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim()
    if (!name || !TRACKING_COOKIE.test(name)) continue
    for (const d of domains) document.cookie = `${name}=; Max-Age=0; path=/${d ? `; domain=${d}` : ''}`
  }
}

export function saveConsent(choice: ConsentChoice, now = Date.now()) {
  const before = readConsent()
  try {
    localStorage.setItem(KEY, JSON.stringify({ choice, v: VERSION, at: now }))
  } catch {
    /* private mode: asked again next visit; nothing loads meanwhile unless accepted */
  }
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: choice }))
  // Scripts already running cannot be unloaded: refusing after accepting reloads the page clean
  if (choice === 'denied' && before === 'granted') {
    clearTrackingCookies()
    window.location.reload()
  }
}

export function onConsentChange(cb: (choice: ConsentChoice) => void) {
  const fn = (e: Event) => cb((e as CustomEvent<ConsentChoice>).detail)
  window.addEventListener(CHANGE_EVENT, fn)
  return () => window.removeEventListener(CHANGE_EVENT, fn)
}

/** Footer "Cookie settings": shows the banner again */
export function openConsent() {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

export function onConsentOpen(cb: () => void) {
  window.addEventListener(OPEN_EVENT, cb)
  return () => window.removeEventListener(OPEN_EVENT, cb)
}
