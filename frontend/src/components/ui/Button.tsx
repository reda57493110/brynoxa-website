import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variants: Record<Variant, string> = {
  primary:
    'bg-[var(--brand)] text-[var(--brand-fg)] hover:brightness-110 shadow-soft font-semibold',
  secondary:
    'bg-[var(--bg-muted)] text-[var(--fg)] hover:bg-[color-mix(in_srgb,var(--bg-muted)_80%,var(--brand)_20%)]',
  ghost: 'bg-transparent text-[var(--fg)] hover:bg-[var(--bg-muted)]',
  danger: 'bg-[var(--danger)] text-white hover:brightness-110',
  outline:
    'border border-[var(--border)] bg-transparent text-[var(--fg)] hover:border-[var(--brand)] hover:text-[var(--brand)]',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-xl',
  md: 'h-11 px-4 text-sm rounded-xl',
  lg: 'h-12 px-6 text-base rounded-2xl',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none ring-brand',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner size="sm" /> : null}
      {children}
    </button>
  )
)

Button.displayName = 'Button'
