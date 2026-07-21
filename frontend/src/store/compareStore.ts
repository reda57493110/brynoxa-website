import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product } from '@/types'
import { COMPARE_MAX } from '@/lib/constants'

interface CompareState {
  items: Product[]
  add: (product: Product) => boolean
  remove: (productId: string) => void
  clear: () => void
  has: (productId: string) => boolean
}

export const useCompareStore = create<CompareState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (product) => {
        const { items } = get()
        if (items.some((i) => i._id === product._id)) return true
        if (items.length >= COMPARE_MAX) return false
        set({ items: [...items, product] })
        return true
      },
      remove: (productId) =>
        set((state) => ({ items: state.items.filter((i) => i._id !== productId) })),
      clear: () => set({ items: [] }),
      has: (productId) => get().items.some((i) => i._id === productId),
    }),
    { name: 'brynoxa-compare' }
  )
)
