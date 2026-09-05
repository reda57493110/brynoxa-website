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

/** Glowing mark from brand pack — matches social profile art. */
const MARK_SRC = '/brand/brynoxa-mark.png'

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
      <span
        className={cn(
          'relative inline-flex shrink-0 overflow-hidden rounded-[0.7rem] bg-[#080B0E]',
          'ring-1 ring-[rgb(0_194_255_/_0.28)]',
          'shadow-[0_0_20px_-4px_rgb(0_194_255_/_0.55)]',
          'transition duration-300',
          'group-hover:ring-[rgb(0_194_255_/_0.5)] group-hover:shadow-[0_0_26px_-2px_rgb(0_194_255_/_0.75)]',
          'h-8 w-8 sm:h-9 sm:w-9',
          markClassName
        )}
      >
        <img
          src={MARK_SRC}
          alt=""
          width={72}
          height={72}
          className="h-full w-full scale-[1.08] object-cover"
          decoding="async"
        />
      </span>
      {wordmark ? (
        <span className="min-w-0 truncate font-display text-base font-bold tracking-tight sm:text-xl">
          Brynox<span className="text-[var(--brand)]">a</span>
          {suffix ? (
            <span className="ml-1.5 text-xs font-medium tracking-normal text-[var(--fg-muted)]">
              {suffix}
            </span>
          ) : null}
        </span>
      ) : null}
    </>
  )

  const shared = cn(
    'group inline-flex min-w-0 items-center gap-2.5 transition duration-200',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
    className
  )

  if (!to) {
    return (
      <span className={shared} aria-label="Brynoxa">
        {content}
      </span>
    )
  }

  return (
    <Link to={to} onClick={onClick} className={shared} aria-label="Brynoxa home">
      {content}
    </Link>
  )
}
