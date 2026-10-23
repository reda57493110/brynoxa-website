import { Link } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useT } from '@/hooks/useT'
import { useSeo } from '@/hooks/useSeo'

/** Unknown address: a real "not found" page (kept out of Google) instead of a silent jump home. */
export function NotFound() {
  const t = useT()
  useSeo({ title: t('notFound.title'), description: t('notFound.body'), noIndex: true })
  return (
    <Container className="flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] text-[var(--brand-text)]">
        <SiteIcon name="search" size={28} />
      </span>
      <p className="mt-5 font-display text-5xl font-bold text-[var(--brand-text)]">404</p>
      <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{t('notFound.heading')}</h1>
      <p className="mt-2 max-w-md text-sm text-[var(--fg-muted)] sm:text-base">{t('notFound.body')}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link
          to="/shop"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--brand)] px-5 text-sm font-semibold text-[var(--brand-fg)] shadow-glow"
        >
          {t('notFound.shop')}
          <SiteIcon name="arrow-right" size={15} className="rtl:rotate-180" />
        </Link>
        <Link
          to="/"
          className="inline-flex h-11 items-center rounded-full border border-[var(--border)] px-5 text-sm font-medium hover:border-[var(--brand)]"
        >
          {t('notFound.home')}
        </Link>
      </div>
    </Container>
  )
}
