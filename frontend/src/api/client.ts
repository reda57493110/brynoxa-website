import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { API_URL } from '@/lib/constants'
import { useAuthStore } from '@/store/authStore'
import type { ApiResponse, AuthPayload } from '@/types'

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = api
      .post<ApiResponse<AuthPayload>>('/auth/refresh')
      .then((res) => {
        const { user, accessToken } = res.data.data
        useAuthStore.getState().setAuth(user, accessToken)
        return accessToken
      })
      .catch(() => {
        useAuthStore.getState().logout()
        return null
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<unknown>>) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    const status = error.response?.status
    const url = original?.url ?? ''

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
    return (error.response?.data as ApiResponse<unknown> | undefined)?.message || fallback
  }
  if (error instanceof Error) return error.message
  return fallback
}

export default api
