import { useQuery } from '@tanstack/react-query'
import { settingsApi } from '@/api/settingsApi'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useT } from '@/hooks/useT'
import { useWhatsAppStore } from '@/store/whatsappStore'
import type { Order } from '@/types'

/** Deposit status, amounts, and how to pay — shown on an order that needs a deposit. */
export function DepositNotice({ order, className }: { order: Order; className?: string }) {
  const t = useT()
  const openWhatsApp = useWhatsAppStore((s) => s.open)
  const deposit = order.deposit
  const awaiting = deposit?.status === 'pending' && order.orderStatus === 'pending'

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await settingsApi.get()).data.data,
    enabled: awaiting,
  })

  if (!deposit || !(deposit.amount > 0) || order.orderStatus === 'cancelled') return null

  const received = deposit.status === 'received'
  const instructions = settings.data?.depositInstructions?.trim()

  return (
    <section
      aria-labelledby="deposit-heading"
      className={cn(
        'rounded-2xl border p-4 text-start sm:p-5',
        received
          ? 'border-[var(--border)] bg-[var(--bg-elevated)]'
          : 'border-[var(--brand)]/50 bg-[var(--brand)]/[0.06]',
        className
      )}
    >
      <h2 id="deposit-heading" className="flex items-center gap-2 font-display text-base font-semibold text-[var(--fg)]">
        <SiteIcon
          name={received ? 'check' : 'banknote'}
          size={18}
          className="text-[var(--brand-text)]"
        />
        {received ? t('deposit.receivedTitle') : t('deposit.title')}
      </h2>

      <dl className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--fg-muted)]">{t('deposit.payNow')}</dt>
          <dd className="font-semibold text-[var(--fg)]">{formatCurrency(deposit.amount)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[var(--fg-muted)]">{t('deposit.payOnDelivery')}</dt>
          <dd className="font-semibold text-[var(--fg)]">
            {formatCurrency(Math.max(0, order.pricing.total - deposit.amount))}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-[var(--fg-muted)]">
        {received ? t('deposit.receivedBody') : t('deposit.pendingBody')}
      </p>

      {awaiting ? (
        <>
          <h3 className="mt-4 text-sm font-semibold text-[var(--fg)]">{t('deposit.howToPay')}</h3>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-[var(--fg)]/85">
            {instructions || t('deposit.noInstructions')}
          </p>
          <button
            type="button"
            onClick={() => openWhatsApp({ topic: 'order' })}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-[var(--brand-fg)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
          >
            <SiteIcon name="chat" size={16} />
            {t('deposit.sendReceipt')}
          </button>
        </>
      ) : null}
    </section>
  )
}
