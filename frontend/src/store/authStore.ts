import { create } from 'zustand'
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
  isAdmin: () => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  bootstrapped: false,
  setAuth: (user, accessToken) => set({ user, accessToken }),
  setUser: (user) => set({ user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setBootstrapped: (bootstrapped) => set({ bootstrapped }),
  logout: () => set({ user: null, accessToken: null }),
  isAuthenticated: () => Boolean(get().accessToken && get().user),
  isAdmin: () => get().user?.role === 'admin',
}))
