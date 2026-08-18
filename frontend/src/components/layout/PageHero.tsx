import type { ReactNode } from 'react'
import { Container } from '@/components/ui/Container'
import { cn } from '@/lib/cn'

export function PageHero({
  kicker,
  title,
  description,
  children,
  titleId = 'page-heading',
  compact = false,
}: {
  kicker: string
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  titleId?: string
  compact?: boolean
}) {
  return (
    <section aria-labelledby={titleId} className="page-hero">
      <Container className={cn('relative z-10', compact ? 'py-8 sm:py-10' : 'py-10 sm:py-12')}>
        <p className="kicker">{kicker}</p>
        <h1
          id={titleId}
          className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl md:text-[2.75rem]"
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--fg-muted)] sm:text-base">
            {description}
          </p>
        ) : null}
        {children ? <div className="mt-6">{children}</div> : null}
      </Container>
    </section>
  )
}
