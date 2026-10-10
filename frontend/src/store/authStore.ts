import { create } from 'zustand'
import { isStaffRole } from '@/lib/permissions'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  bootstrapped: boolean
  setAuth: (user: User, accessToken: string) => void
  setUser: (user: User | null) => void
  setAccessToken: (token: string | null) => void
  setBootstrapped: (value: boolean) => void
  logout: () => void
  isAuthenticated: () => boolean
  /** Any staff role that can open /admin */
  isAdmin: () => boolean
}

/**
 * Remembers whether this browser had a session ('1') or is a known guest ('0'), so guests
 * don't call /auth/refresh (always 401) on every page load. Unset = unknown: check once.
 */
export const SESSION_HINT_KEY = 'brx_session'
function setSessionHint(value: '0' | '1') {
  try {
    localStorage.setItem(SESSION_HINT_KEY, value)
  } catch {
    /* storage blocked: the app still works, it just checks every visit */
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  bootstrapped: false,
  setAuth: (user, accessToken) => {
    setSessionHint('1')
    set({ user, accessToken })
  },
  setUser: (user) => set({ user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setBootstrapped: (bootstrapped) => set({ bootstrapped }),
  logout: () => {
    setSessionHint('0')
    set({ user: null, accessToken: null })
  },
  isAuthenticated: () => Boolean(get().accessToken && get().user),
  isAdmin: () => isStaffRole(get().user?.role),
}))
