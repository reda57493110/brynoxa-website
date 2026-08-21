import type { ReactNode } from 'react'
import { Container } from '@/components/ui/Container'
import { cn } from '@/lib/cn'

export function PageHero({
  kicker,
  title,
  description,
  children,
  titleId = 'page-heading',
  className,
}: {
  kicker: string
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  titleId?: string
  className?: string
}) {
  return (
    <section aria-labelledby={titleId} className={cn('page-hero', className)}>
      <Container className="relative z-10 py-5 sm:py-10">
        <p className="kicker text-reveal">{kicker}</p>
        <h1
          id={titleId}
          className="text-reveal mt-2 font-display text-3xl font-semibold tracking-tight text-[var(--fg)] sm:mt-3 sm:text-4xl md:text-[2.75rem]"
          style={{ animationDelay: '40ms' }}
        >
          {title}
        </h1>
        {description ? (
          <p
            className="text-reveal mt-2 max-w-xl text-sm font-medium leading-relaxed text-[var(--fg-muted)] sm:mt-3 sm:text-base sm:leading-7"
            style={{ animationDelay: '80ms' }}
          >
            {description}
          </p>
        ) : null}
        {children ? (
          <div className="text-reveal mt-4 sm:mt-6" style={{ animationDelay: '120ms' }}>
            {children}
          </div>
        ) : null}
      </Container>
    </section>
  )
}
