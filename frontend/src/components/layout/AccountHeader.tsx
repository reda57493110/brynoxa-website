import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { SiteIcon } from '@/components/ui/SiteIcon'

/** Compact header for account pages: optional back link, title, and inline actions. */
export function AccountHeader({
  title,
  back,
  meta,
  actions,
}: {
  title: ReactNode
  back?: { to: string; label: string }
  meta?: ReactNode
  actions?: ReactNode
}) {
  return (
    <Container className="pt-6 sm:pt-8">
      {back ? (
        <Link
          to={back.to}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--fg-muted)] transition hover:text-[var(--brand-text)]"
        >
          <SiteIcon name="arrow-left" size={16} className="rtl:rotate-180" />
          {back.label}
        </Link>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1
            id="page-heading"
            className="font-display text-2xl font-semibold tracking-tight text-[var(--fg)] sm:text-3xl"
          >
            {title}
          </h1>
          {meta}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </Container>
  )
}
