import { forwardRef, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, id, ...props }, ref) => {
    const inputId = id || props.name
    return (
      <label className="flex w-full flex-col gap-1.5 text-sm">
        {label ? <span className="font-medium text-[var(--fg)]">{label}</span> : null}
        <select
          ref={ref}
          id={inputId}
          className={cn(
            'h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3.5 text-[var(--fg)] outline-none transition ring-brand',
            error && 'border-[var(--danger)]',
            className
          )}
          {...props}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error ? <span className="text-xs text-[var(--danger)]">{error}</span> : null}
      </label>
    )
  }
)

Select.displayName = 'Select'
