import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'

type BrandLogoProps = {
  to?: string
  className?: string
  /** Show wordmark next to the mark (default true) */
  wordmark?: boolean
  /** Optional trailing label e.g. Admin */
  suffix?: string
  markClassName?: string
  onClick?: () => void
}

export function BrandLogo({
  to = '/',
  className,
  wordmark = true,
  suffix,
  markClassName,
  onClick,
}: BrandLogoProps) {
  const content = (
    <>
      <img
        src="/brand/mark.svg"
        alt=""
        width={32}
        height={32}
        className={cn('h-8 w-8 shrink-0 rounded-lg', markClassName)}
        decoding="async"
      />
      {wordmark ? (
        <span className="min-w-0 truncate font-display text-base font-bold tracking-tight sm:text-xl">
          Brynox<span className="text-[var(--brand)]">a</span>
          {suffix ? (
            <span className="ml-1 text-xs font-medium text-[var(--fg-muted)]">{suffix}</span>
          ) : null}
        </span>
      ) : null}
    </>
  )

  if (!to) {
    return (
      <span className={cn('inline-flex items-center gap-2', className)} aria-label="Brynoxa">
        {content}
      </span>
    )
  }

  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        'inline-flex min-w-0 items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
        className
      )}
      aria-label="Brynoxa"
    >
      {content}
    </Link>
  )
}
