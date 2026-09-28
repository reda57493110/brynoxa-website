import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { usePush } from '@/hooks/usePush'
import { useT } from '@/hooks/useT'
import { useLocaleStore } from '@/store/localeStore'
import { loadGuestReceipt } from '@/lib/guestReceipt'
import {
  PUSH_ENGAGED_EVENT,
  dismissPushPrompt,
  hasEngagedEnough,
  isPushPromptSnoozed,
  syncPushLocale,
} from '@/lib/push'
import { cn } from '@/lib/cn'

const SHOW_DELAY_MS = 1500
const ORDER_ASKED_KEY = 'brynoxa-push-order-asked'

function orderNumberFromPath(pathname: string) {
  const match = pathname.match(/^\/order-confirmation\/([^/]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

function wasAskedForOrder(orderNumber: string) {
  try {
    return localStorage.getItem(ORDER_ASKED_KEY) === orderNumber
  } catch {
    return true
  }
}

function markAskedForOrder(orderNumber: string) {
  try {
    localStorage.setItem(ORDER_ASKED_KEY, orderNumber)
  } catch {
    /* storage unavailable */
  }
}

/**
 * Soft, in-page ask shown after the shopper has shown interest (or right after an order,
 * offering delivery updates). The native permission prompt opens only on "Yes".
 */
export function PushPrompt() {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const { pathname } = useLocation()
  const { status, ready, busy, enable } = usePush()
  const [engaged, setEngaged] = useState(hasEngagedEnough)
  const [visible, setVisible] = useState(false)

  const orderNumber = orderNumberFromPath(pathname)

  useEffect(() => {
    void syncPushLocale(locale).catch(() => undefined)
  }, [locale])

  useEffect(() => {
    const onEngaged = () => setEngaged(true)
    window.addEventListener(PUSH_ENGAGED_EVENT, onEngaged)
    return () => window.removeEventListener(PUSH_ENGAGED_EVENT, onEngaged)
  }, [])

  useEffect(() => {
    const eligible = orderNumber
      ? !wasAskedForOrder(orderNumber)
      : engaged && !isPushPromptSnoozed()
    if (!ready || status !== 'available' || !eligible) {
      setVisible(false)
      return
    }
    const timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [ready, engaged, status, orderNumber])

  const onCheckout = pathname.startsWith('/checkout')
  if (!visible || onCheckout) return null

  const aboveStickyBar = pathname.startsWith('/product/') || pathname === '/cart'

  const later = () => {
    if (orderNumber) markAskedForOrder(orderNumber)
    dismissPushPrompt()
    setVisible(false)
  }

  const allow = async () => {
    let order: { orderNumber: string; token: string } | undefined
    if (orderNumber) {
      markAskedForOrder(orderNumber)
      const receipt = loadGuestReceipt(orderNumber)
      if (receipt) order = { orderNumber, token: receipt.receiptToken }
    }
    await enable(order)
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-labelledby="push-prompt-title"
      aria-describedby="push-prompt-body"
      className={cn(
        'toast-enter fixed inset-x-3 z-50 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-soft',
        'sm:inset-x-auto sm:bottom-6 sm:end-6 sm:w-[23rem]',
        aboveStickyBar
          ? 'bottom-[calc(5.25rem+env(safe-area-inset-bottom))]'
          : 'bottom-[calc(0.75rem+env(safe-area-inset-bottom))]'
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--brand)_15%,transparent)] text-[var(--brand-text)]">
          <SiteIcon name={orderNumber ? 'truck' : 'bell'} size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p id="push-prompt-title" className="font-display text-sm font-semibold text-[var(--fg)]">
            {orderNumber ? t('push.orderPromptTitle') : t('push.promptTitle')}
          </p>
          <p id="push-prompt-body" className="mt-1 text-xs leading-relaxed text-[var(--fg-muted)] sm:text-sm">
            {orderNumber ? t('push.orderPromptBody') : t('push.promptBody')}
          </p>
        </div>
        <button
          type="button"
          onClick={later}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--fg-muted)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
          aria-label={t('push.close')}
        >
          <SiteIcon name="close" size={14} />
        </button>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={later} disabled={busy}>
          {t('push.notNow')}
        </Button>
        <Button size="sm" onClick={allow} loading={busy}>
          {orderNumber ? t('push.orderAllow') : t('push.allow')}
        </Button>
      </div>
    </div>
  )
}
