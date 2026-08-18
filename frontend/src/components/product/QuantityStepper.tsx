import { SiteIcon } from '@/components/ui/SiteIcon'

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
  const btn =
    'inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--fg)] transition hover:bg-[var(--bg-muted)] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]'

  return (
    <div className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-input)] p-0.5">
      <button
        type="button"
        className={btn}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label="Decrease quantity"
      >
        <SiteIcon name="minus" size={14} />
      </button>
      <span className="min-w-10 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        className={btn}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        aria-label="Increase quantity"
      >
        <SiteIcon name="plus" size={14} />
      </button>
    </div>
  )
}
