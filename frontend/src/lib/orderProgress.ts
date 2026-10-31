import { useT } from '@/hooks/useT'
import type { MessageKey } from '@/i18n'

/** The simple progress shown to customers (detailed statuses map onto these). */
export const ORDER_STEPS = ['pending', 'confirmed', 'shipped', 'delivered'] as const

/** Where a detailed status sits on the 4 steps (not reached yet → still pending, courier issues → shipped). */
export function orderStepIndex(status: string) {
  if (status === 'confirmed' || status === 'processing') return 1
  if (status === 'shipped' || status === 'rescheduled' || status === 'delivery_failed') return 2
  if (status === 'delivered' || /return/.test(status)) return 3
  return 0
}

/** Statuses with a customer explanation (the same lines as the notifications). */
const EXPLAINED = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'no_answer', 'delivery_failed', 'rescheduled', 'return_requested', 'partially_returned', 'returned']

/** "Your order is on the way. The courier will contact you…" for the current status. */
export function useStatusLine() {
  const t = useT()
  return (status: string) => (EXPLAINED.includes(status) ? t(`notify.${status}.line` as MessageKey) : '')
}
