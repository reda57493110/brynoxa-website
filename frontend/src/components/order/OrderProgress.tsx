import { SiteIcon } from '@/components/ui/SiteIcon'
import { useT } from '@/hooks/useT'
import { orderStatusKey } from '@/i18n'
import { ORDER_STEPS, orderStepIndex } from '@/lib/orderProgress'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/cn'

type Step = { status: string; at: string; note?: string }

/**
 * 4-step progress (placed → confirmed → shipped → delivered), the latest update, and the full
 * history folded. `notes: false` hides the step notes (the short view of Track order by phone).
 */
export function OrderProgress({ status, timeline, notes = true, className }: { status: string; timeline: Step[]; notes?: boolean; className?: string }) {
  const t = useT()
  const stepIndex = orderStepIndex(status)
  const latest = timeline[timeline.length - 1]

  return (
    <div className={className}>
      {status === 'cancelled' ? (
        <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--danger)]">
          <SiteIcon name="close" size={14} />
          {t(orderStatusKey('cancelled'))}
        </p>
      ) : (
        <ol className="flex items-start" aria-label={t('orders.tracking')}>
          {ORDER_STEPS.map((step, i) => {
            const done = i <= stepIndex
            return (
              <li key={step} className="flex flex-1 flex-col items-center text-center" aria-current={i === stepIndex ? 'step' : undefined}>
                <div className="flex w-full items-center">
                  <span className={cn('h-0.5 flex-1', i === 0 ? 'invisible' : done ? 'bg-[var(--brand)]' : 'bg-[var(--border)]')} />
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                      done ? 'bg-[var(--brand)] text-[var(--brand-fg)]' : 'border border-[var(--border)] text-[var(--fg-muted)]',
                      i === stepIndex && 'ring-4 ring-[color-mix(in_srgb,var(--brand)_22%,transparent)]'
                    )}
                  >
                    {done ? <SiteIcon name="check" size={11} /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      'h-0.5 flex-1',
                      i === ORDER_STEPS.length - 1 ? 'invisible' : i < stepIndex ? 'bg-[var(--brand)]' : 'bg-[var(--border)]'
                    )}
                  />
                </div>
                <span className={cn('mt-1 text-[10px] capitalize sm:text-xs', done ? 'font-medium text-[var(--fg)]' : 'text-[var(--fg-muted)]')}>
                  {t(orderStatusKey(step))}
                </span>
              </li>
            )
          })}
        </ol>
      )}
      {latest ? (
        <p className="mt-3 text-xs text-[var(--fg-muted)]">
          {notes && latest.note ? latest.note : <span className="capitalize">{t(orderStatusKey(latest.status))}</span>} · {formatDateTime(latest.at)}
        </p>
      ) : null}
      {timeline.length > 1 ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-[var(--brand-text)]">{t('orders.history')}</summary>
          <ol className="mt-2 space-y-2">
            {[...timeline].reverse().map((entry, i) => (
              <li key={i} className="flex gap-2 text-xs">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" />
                <span>
                  <span className="font-medium capitalize">{t(orderStatusKey(entry.status))}</span>
                  {notes && entry.note ? <span className="text-[var(--fg-muted)]"> — {entry.note}</span> : null}
                  <span className="block text-[var(--fg-muted)]">{formatDateTime(entry.at)}</span>
                </span>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  )
}
