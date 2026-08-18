import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || props.name
    return (
      <label className="flex w-full flex-col gap-1.5 text-sm">
        {label ? <span className="font-medium text-[var(--fg)]">{label}</span> : null}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'min-h-28 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3.5 py-3 text-[var(--fg)] placeholder:text-[var(--fg-muted)] outline-none transition ring-brand resize-y',
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

Textarea.displayName = 'Textarea'
