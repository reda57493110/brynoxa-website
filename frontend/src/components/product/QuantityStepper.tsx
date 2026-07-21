import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'

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
  return (
    <div className="inline-flex items-center rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="rounded-xl"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label="Decrease quantity"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <span className="min-w-10 text-center text-sm font-semibold">{value}</span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="rounded-xl"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        aria-label="Increase quantity"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}
