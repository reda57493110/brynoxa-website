import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || props.name
    return (
      <label className="flex w-full flex-col gap-1.5 text-sm">
        {label ? <span className="font-medium text-[var(--fg)]">{label}</span> : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3.5 text-[var(--fg)] placeholder:text-[var(--fg-muted)] outline-none transition ring-brand',
            error && 'border-[var(--danger)]',
            className
          )}
          {...props}
        />
        {error ? <span className="text-xs text-[var(--danger)]">{error}</span> : null}
      </label>
    )
  }
)

Input.displayName = 'Input'
