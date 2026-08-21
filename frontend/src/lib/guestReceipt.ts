import type { Order } from '@/types'

const KEY = 'brynoxa-guest-receipt'

export type GuestReceipt = {
  orderNumber: string
  email: string
  order: Order
}

export function saveGuestReceipt(orderNumber: string, email: string, order: Order) {
  try {
    const payload: GuestReceipt = { orderNumber, email, order }
    sessionStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    // ignore quota / private mode
  }
}

export function loadGuestReceipt(orderNumber: string): GuestReceipt | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as GuestReceipt
    if (parsed.orderNumber !== orderNumber) return null
    return parsed
  } catch {
    return null
  }
}
