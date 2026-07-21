import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Product } from '@/types'

interface WishlistState {
  ids: string[]
  products: Product[]
  setFromServer: (products: Product[]) => void
  toggleLocal: (productId: string) => void
  isWishlisted: (productId: string) => boolean
  clear: () => void
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      products: [],
      setFromServer: (products) =>
        set({
          products,
          ids: products.map((p) => p._id),
        }),
      toggleLocal: (productId) =>
        set((state) => {
          const exists = state.ids.includes(productId)
          return {
            ids: exists
              ? state.ids.filter((id) => id !== productId)
              : [...state.ids, productId],
            products: exists
              ? state.products.filter((p) => p._id !== productId)
              : state.products,
          }
        }),
      isWishlisted: (productId) => get().ids.includes(productId),
      clear: () => set({ ids: [], products: [] }),
    }),
    {
      name: 'brynoxa-wishlist',
      partialize: (state) => ({ ids: state.ids }),
    }
  )
)
