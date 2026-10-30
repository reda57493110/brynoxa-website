import type { MessageKey } from '@/i18n'

type T = (key: MessageKey, vars?: Record<string, string | number>) => string

/** Order-status notifications, by the English title the server stores (backend orderNotify.service.ts). */
const STATUS_BY_TITLE: Record<string, string> = {
  'Order placed': 'pending',
  'Order confirmed': 'confirmed',
  'Order shipped': 'shipped',
  'Order delivered': 'delivered',
  'Order cancelled': 'cancelled',
  'We tried to reach you': 'no_answer',
  'Delivery attempt failed': 'delivery_failed',
  'Delivery rescheduled': 'rescheduled',
  'Return request received': 'return_requested',
  'Returned items received': 'partially_returned',
  'Return received': 'returned',
}

/**
 * Notifications are saved in English (also older ones). The standard ones are shown in the
 * visitor's language: same meaning, order number kept. Anything else is shown as saved.
 */
export function localizeNotification(item: { title: string; message: string }, t: T): { title: string; message: string } {
  const numbered = item.message.match(/^(.*?)\s*\(([A-Z0-9-]+)\)\s*$/s)
  const body = numbered ? numbered[1] : item.message
  const suffix = numbered ? ` (${numbered[2]})` : ''

  const status = STATUS_BY_TITLE[item.title]
  if (status) {
    const date = body.match(/New date: (.+?)\.?$/)
    const line = t(`notify.${status}.line` as MessageKey)
    return {
      title: t(`notify.${status}.title` as MessageKey),
      message: `${line}${date ? ` ${t('notify.newDate', { date: date[1] })}` : ''}${suffix}`,
    }
  }
  if (item.title === 'Order deposit') {
    const needed = body.match(/^A deposit of (.+) is needed to confirm this order$/)
    const message = needed
      ? t('notify.depositNeeded', { amount: needed[1] })
      : body === 'No deposit is needed for this order anymore'
        ? t('notify.depositRemoved')
        : body === 'We received your deposit'
          ? t('notify.depositReceived')
          : null
    if (message) return { title: t('notify.depositTitle'), message: `${message}${suffix}` }
  }
  if (item.title === 'Refund') {
    const refund = body.match(/^A refund of (.+) was recorded$/)
    if (refund) return { title: t('notify.refundTitle'), message: `${t('notify.refundRecorded', { amount: refund[1] })}${suffix}` }
  }
  return item
}
