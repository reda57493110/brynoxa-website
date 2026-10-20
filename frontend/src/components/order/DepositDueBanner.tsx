import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ordersApi } from '@/api/ordersApi'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { depositState } from '@/components/order/DepositNotice'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useT } from '@/hooks/useT'

/** Account pages: one alert per order still waiting for its deposit, with a direct "Pay deposit". */
export function DepositDueBanner({ className }: { className?: string }) {
  const t = useT()
  const orders = useQuery({
    queryKey: ['orders'],
    // Always fresh when opened (new orders, deposit updates)
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => (await ordersApi.list({ limit: 50 })).data.data,
  })
  const waiting = (orders.data ?? []).filter((o) => {
    const s = depositState(o)
    return s === 'due' || s === 'reported'
  })
  if (!waiting.length) return null

  return (
    <div className={cn('space-y-2', className)}>
      {waiting.map((o) => {
        const reported = depositState(o) === 'reported'
        return (
          <div
            key={o._id}
            role="status"
            className={cn(
              'flex flex-wrap items-center gap-3 rounded-2xl border p-3 sm:flex-nowrap sm:p-4',
              reported
                ? 'border-[var(--border)] bg-[var(--bg-elevated)]'
                : 'border-[var(--brand)]/50 bg-[var(--brand)]/[0.07]'
            )}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] text-[var(--brand-text)]">
              <SiteIcon name={reported ? 'clock' : 'banknote'} size={18} />
            </span>
            <div className="min-w-0 flex-1 basis-[12rem]">
              <p className="text-sm font-semibold">
                {reported ? t('deposit.bannerReported', { number: o.orderNumber }) : t('deposit.bannerTitle', { number: o.orderNumber })}
              </p>
              {!reported ? (
                <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
                  {t('deposit.bannerBody', { amount: formatCurrency(o.deposit?.amount ?? 0) })}
                </p>
              ) : null}
            </div>
            <Link
              to={`/account/orders/${o.orderNumber}#deposit`}
              className={cn(
                'inline-flex h-10 w-full shrink-0 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition sm:w-auto',
                reported
                  ? 'border border-[var(--border)] text-[var(--fg)] hover:border-[var(--brand)]'
                  : 'bg-[var(--brand)] text-[var(--brand-fg)] hover:brightness-110'
              )}
            >
              {reported ? t('deposit.viewOrder') : t('deposit.payDeposit')}
              <SiteIcon name="arrow-right" size={14} className="rtl:rotate-180" />
            </Link>
          </div>
        )
      })}
    </div>
  )
}
