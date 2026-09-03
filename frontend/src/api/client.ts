import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { API_URL } from '@/lib/constants'
import { useAuthStore } from '@/store/authStore'
import { useNetworkStore } from '@/store/networkStore'
import type { ApiResponse, SessionPayload } from '@/types'

type TrackedConfig = InternalAxiosRequestConfig & {
  skipLoader?: boolean
  _loaderStarted?: boolean
}

function shouldSkipLoader(config: TrackedConfig) {
  if (config.skipLoader) return true
  const url = `${config.baseURL || ''}${config.url || ''}`
  return /\/auth\/(csrf|refresh|me|logout)/.test(url) || /\/wishlist/.test(url) || /\/notifications/.test(url)
}

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 45_000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const tracked = config as TrackedConfig
  if (!shouldSkipLoader(tracked)) {
    useNetworkStore.getState().begin()
    tracked._loaderStarted = true
  }
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let refreshPromise: Promise<string | null> | null = null
let sessionChecked = false
let csrfToken: string | null = null

async function getCsrfToken() {
  if (csrfToken) return csrfToken
  const response = await api.get<ApiResponse<{ csrfToken: string }>>('/auth/csrf', {
    skipLoader: true,
  } as InternalAxiosRequestConfig)
  csrfToken = response.data.data.csrfToken
  return csrfToken
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = getCsrfToken()
      .then((token) =>
        api.post<ApiResponse<SessionPayload>>('/auth/refresh', undefined, {
          headers: { 'X-CSRF-Token': token },
          skipLoader: true,
        } as InternalAxiosRequestConfig)
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
}

export async function restoreSession(force = false) {
  const existing = useAuthStore.getState().accessToken
  if (!force && sessionChecked && !refreshPromise) {
    if (existing) return existing
    // Memory token missing (HMR / tab race) but cookie may still be valid — try refresh once.
  }
  const token = await refreshAccessToken()
  sessionChecked = true
  return token
}

api.interceptors.response.use(
  (response) => {
    if ((response.config as TrackedConfig)._loaderStarted) {
      useNetworkStore.getState().end()
    }
    return response
  },
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const original = error.config as TrackedConfig & { _retry?: boolean }
    if (original?._loaderStarted) {
      useNetworkStore.getState().end()
      original._loaderStarted = false
    }
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
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      if (error.code === 'ECONNABORTED') return 'Request timed out — try again'
      return 'Cannot reach the server — check that the API is running'
    }
    const data = error.response.data as
      | { message?: string; errors?: Record<string, string[] | undefined> }
      | undefined
    if (data?.errors && typeof data.errors === 'object') {
      const parts = Object.entries(data.errors)
        .flatMap(([field, msgs]) => (msgs || []).map((m) => `${field}: ${m}`))
        .filter(Boolean)
      if (parts.length) return parts.join(' · ')
    }
    return data?.message || fallback
  }
  if (error instanceof Error) return error.message
  return fallback
}

export default api
