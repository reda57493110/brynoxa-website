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
  addItem: (item: Omit<CartItem, 'qty'> & { qty?: number }) => void
  removeItem: (productId: string) => void
  updateQty: (productId: string, qty: number) => void
  clear: () => void
  subtotal: () => number
  itemCount: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
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
      subtotal: () => get().items.reduce((sum, i) => sum + i.price * i.qty, 0),
      itemCount: () => get().items.reduce((sum, i) => sum + i.qty, 0),
    }),
    { name: 'brynoxa-cart' }
  )
)
