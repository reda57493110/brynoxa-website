import { Link } from 'react-router-dom'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useT } from '@/hooks/useT'

/** Slim top bar for account pages: the logo and one clear way back to the store. */
export function AccountBar() {
  const t = useT()
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--bg)] px-3 pt-[env(safe-area-inset-top)] sm:px-8 lg:px-12">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3">
        <BrandLogo className="min-w-0 shrink" markClassName="h-8 w-8" />
        <Link
          to="/"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-[var(--brand-fg)] transition hover:brightness-110"
        >
          <SiteIcon name="arrow-left" size={15} className="rtl:rotate-180" />
          {t('account.backToStore')}
        </Link>
      </div>
    </header>
  )
}
