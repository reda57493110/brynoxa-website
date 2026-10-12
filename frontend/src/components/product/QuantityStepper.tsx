import { SiteIcon } from '@/components/ui/SiteIcon'
import { useT } from '@/hooks/useT'

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
}: {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}) {
  const t = useT()
  const btn =
    'inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--fg)] transition sm:h-9 sm:w-9 hover:bg-[var(--bg-muted)] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]'

  return (
    <div className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-input)] p-0.5">
      <button
        type="button"
        className={btn}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label={t('ui.decreaseQty')}
      >
        <SiteIcon name="minus" size={14} />
      </button>
      <span className="min-w-8 text-center text-[13px] font-semibold tabular-nums sm:min-w-10 sm:text-sm">{value}</span>
      <button
        type="button"
        className={btn}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        aria-label={t('ui.increaseQty')}
      >
        <SiteIcon name="plus" size={14} />
      </button>
    </div>
  )
}
