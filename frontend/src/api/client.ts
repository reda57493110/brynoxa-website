import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { translate } from '@/i18n'
import { useLocaleStore } from '@/store/localeStore'
import { localizeServerMessage } from '@/lib/serverMessages'
import { API_URL } from '@/lib/constants'
import { SESSION_HINT_KEY, useAuthStore } from '@/store/authStore'
import { isStaffRole } from '@/lib/permissions'
import type { ApiResponse, SessionPayload } from '@/types'

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 45_000,
  headers: { 'Content-Type': 'application/json' },
})

/**
 * Shop data public/preload.js started fetching before the app ran (the first requests of the page
 * a shopper lands on). Each answer is used once, by the same address, within 20 s; anything that
 * fails or doesn't match goes to the server as usual.
 */
type EarlyAnswers = Record<string, { at: number; response: Promise<unknown> } | undefined>
const EARLY_MAX_AGE_MS = 20_000
const networkAdapter = axios.getAdapter(axios.defaults.adapter)
api.defaults.adapter = async (config) => {
  const early = (window as Window & { __brynoxaEarly?: EarlyAnswers }).__brynoxaEarly
  if (early && (config.method || 'get').toLowerCase() === 'get') {
    const key = api.getUri(config)
    const hit = early[key]
    if (hit) {
      delete early[key]
      const data = Date.now() - hit.at < EARLY_MAX_AGE_MS ? await hit.response : null
      if (data) return { data, status: 200, statusText: 'OK', headers: {}, config, request: null }
    }
  }
  return networkAdapter(config)
}

/** Public shop data the edge keeps for 60 s (see api/_lib/http.js cachePublic). */
const SHARED_CACHE_PATH = /^\/(products|categories|brands|settings)(\/|\?|$)/

api.interceptors.request.use((config) => {
  const { accessToken: token, user } = useAuthStore.getState()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // Staff see their own changes at once: skip the shared copy for shop data
  const method = (config.method || 'get').toLowerCase()
  if (method === 'get' && isStaffRole(user?.role) && SHARED_CACHE_PATH.test(config.url || '')) {
    config.params = { ...(config.params || {}), fresh: Date.now() }
  }
  return config
})

let refreshPromise: Promise<string | null> | null = null
let sessionChecked = false
let csrfToken: string | null = null

/**
 * The CSRF token stays the same for the life of the sign-in cookie, so it is remembered on this
 * device: opening the site then signs in again with one request instead of two (a round trip saved
 * on every visit, most noticeable on phones). Any page script could fetch it anyway, so keeping it
 * adds nothing for an attacker; if the server refuses it, a fresh one is fetched and tried once.
 */
const CSRF_KEY = 'brynoxa-csrf'

function rememberCsrf(token: string | null) {
  try {
    if (token) localStorage.setItem(CSRF_KEY, token)
    else localStorage.removeItem(CSRF_KEY)
  } catch {
    /* private mode: just keep it in memory */
  }
}

async function getCsrfToken(fresh = false) {
  if (!fresh) {
    if (csrfToken) return csrfToken
    try {
      csrfToken = localStorage.getItem(CSRF_KEY)
    } catch {
      csrfToken = null
    }
    if (csrfToken) return csrfToken
  }
  const response = await api.get<ApiResponse<{ csrfToken: string }>>('/auth/csrf')
  csrfToken = response.data.data.csrfToken
  rememberCsrf(csrfToken)
  return csrfToken
}

const postRefresh = (token: string) =>
  api.post<ApiResponse<SessionPayload>>('/auth/refresh', undefined, { headers: { 'X-CSRF-Token': token } })

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = getCsrfToken()
      .then((token) =>
        postRefresh(token).catch(async (err: AxiosError) => {
          // A remembered token the server no longer matches: get the current one and try once more
          if (err.response?.status !== 403) throw err
          return postRefresh(await getCsrfToken(true))
        })
      )
      .then((res) => {
        const payload = res.data.data
        if (!payload?.user || !payload.accessToken) {
          sessionChecked = false
          useAuthStore.getState().logout()
          return null
        }
        useAuthStore.getState().setAuth(payload.user, payload.accessToken)
        return payload.accessToken
      })
      .catch(() => {
        sessionChecked = false
        useAuthStore.getState().logout()
        return null
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

/** Clear the one-shot bootstrap flag (e.g. after logout) so the next visit can refresh again. */
export function resetSessionCheck() {
  sessionChecked = false
  csrfToken = null
  rememberCsrf(null)
}

/** True when this browser is known to be signed out (no refresh cookie worth trying). */
function knownGuest() {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) === '0'
  } catch {
    return false
  }
}

export async function restoreSession(force = false) {
  const existing = useAuthStore.getState().accessToken
  if (!force && !existing && knownGuest()) {
    sessionChecked = true
    return null
  }
  if (!force && sessionChecked && !refreshPromise) {
    if (existing) return existing
    // Memory token missing (HMR / tab race) but cookie may still be valid — try refresh once.
  }
  const token = await refreshAccessToken()
  sessionChecked = true
  return token
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    const status = error.response?.status
    const url = original?.url ?? ''

    // Always try cookie refresh on 401 — accessToken may already be null in memory
    // while the httpOnly refresh cookie is still valid.
    if (
      status === 401 &&
      original &&
      !original._retry &&
      !url.includes('/auth/login') &&
      !url.includes('/auth/register') &&
      !url.includes('/auth/refresh')
    ) {
      original._retry = true
      const token = await refreshAccessToken()
      if (token) {
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      }
    }

    return Promise.reject(error)
  }
)

export function getErrorMessage(error: unknown, fallback = 'Something went wrong') {
  // Shown in the visitor's language (server texts are English; see lib/serverMessages.ts)
  const locale = useLocaleStore.getState().locale
  const shown = (message: string) => localizeServerMessage(message, locale)
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      if (error.code === 'ECONNABORTED') return translate(locale, 'server.timeout')
      return translate(locale, 'server.offline')
    }
    const data = error.response.data as
      | { message?: string; errors?: Record<string, string[] | undefined> }
      | undefined
    if (data?.errors && typeof data.errors === 'object') {
      const parts = Object.entries(data.errors)
        .flatMap(([field, msgs]) => (msgs || []).map((m) => `${field}: ${m}`))
        .filter(Boolean)
      if (parts.length) return shown(parts.join(' · '))
    }
    return shown(data?.message || fallback)
  }
  if (error instanceof Error) return shown(error.message)
  return shown(fallback)
}

export default api
