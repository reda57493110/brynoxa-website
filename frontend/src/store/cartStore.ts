import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem as BaseCartItem, ProductCondition } from '@/types'
import { trackAddToCart } from '@/lib/analytics'
import { recordAddToCart } from '@/lib/push'

/**
 * Cart line as stored. `condition` is optional so carts saved before it existed still load
 * (missing = new / unknown).
 */
export type CartItem = BaseCartItem & { condition?: ProductCondition }

interface CartState {
  items: CartItem[]
  /** Last "Add to cart" (not persisted) so the store can show the added-to-cart panel */
  lastAdded: { productId: string; qty: number; at: number } | null
  dismissAdded: () => void
  addItem: (item: Omit<CartItem, 'qty'> & { qty?: number }) => void
  removeItem: (productId: string) => void
  updateQty: (productId: string, qty: number) => void
  clear: () => void
  /** Today's price and stock from the shop; returns the names whose price changed */
  syncLive: (live: { _id: string; price: number; stock: number }[]) => string[]
  subtotal: () => number
  itemCount: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      lastAdded: null,
      dismissAdded: () => set({ lastAdded: null }),
      addItem: (item) => {
        const qty = item.qty ?? 1
        set((state) => {
          const existing = state.items.find((i) => i.productId === item.productId)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === item.productId
                  ? { ...i, condition: item.condition ?? i.condition, qty: Math.min(i.qty + qty, i.stock) }
                  : i
              ),
            }
          }
          return {
            items: [...state.items, { ...item, qty: Math.min(qty, item.stock) }],
          }
        })
        set({ lastAdded: { productId: item.productId, qty, at: Date.now() } })
        trackAddToCart({
          item_id: item.productId,
          item_name: item.name,
          item_sku: item.sku,
          price: item.price,
          quantity: qty,
        })
        recordAddToCart()
      },
      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),
      updateQty: (productId, qty) =>
        set((state) => ({
          items: state.items
            .map((i) =>
              i.productId === productId
                ? { ...i, qty: Math.max(1, Math.min(qty, i.stock)) }
                : i
            )
            .filter((i) => i.qty > 0),
        })),
      clear: () => set({ items: [] }),
      syncLive: (live) => {
        const changed: string[] = []
        let touched = false
        const items = get().items.map((i) => {
          const p = live.find((l) => l._id === i.productId)
          if (!p || (p.price === i.price && p.stock === i.stock)) return i
          touched = true
          if (p.price !== i.price) changed.push(i.name)
          return { ...i, price: p.price, stock: p.stock }
        })
        if (touched) set({ items })
        return changed
      },
      subtotal: () => get().items.reduce((sum, i) => sum + i.price * i.qty, 0),
      itemCount: () => get().items.reduce((sum, i) => sum + i.qty, 0),
    }),
    { name: 'brynoxa-cart', partialize: (s) => ({ items: s.items }) }
  )
)
