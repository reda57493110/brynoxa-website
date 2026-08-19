import { Link } from 'react-router-dom'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { Container } from '@/components/ui/Container'
import { PageHero } from '@/components/layout/PageHero'
import { surfaceCard } from '@/components/layout/pageStyles'
import { useAuthStore } from '@/store/authStore'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useT } from '@/hooks/useT'

export function Account() {
  const t = useT()
  usePageTitle(t('account.title'))
  const user = useAuthStore((s) => s.user)

  const links: { to: string; label: string; desc: string; icon: SiteIconName }[] = [
    { to: '/account/orders', label: t('account.orders'), desc: t('account.ordersDesc'), icon: 'package' },
    { to: '/wishlist', label: t('account.wishlist'), desc: t('account.wishlistDesc'), icon: 'heart' },
    { to: '/account/reviews', label: t('account.reviews'), desc: t('account.reviewsDesc'), icon: 'star' },
    { to: '/account/settings', label: t('account.settings'), desc: t('account.settingsDesc'), icon: 'settings' },
  ]

  return (
    <>
      <PageHero
        kicker={t('account.kicker')}
        title={t('account.heading')}
        description={
          user?.name ? t('account.signedIn', { name: user.name }) : t('account.signedInGeneric')
        }
      />
      <Container className="py-8 sm:py-10">
        <div className="grid gap-4 sm:grid-cols-2">
          {links.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`${surfaceCard} group flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-soft-lg`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand-text)] dark:text-[var(--brand)]">
                <SiteIcon name={item.icon} size={20} />
              </span>
              <span className="flex-1">
                <span className="block font-display font-semibold">{item.label}</span>
                <span className="text-sm text-[var(--fg-muted)]">{item.desc}</span>
              </span>
              <SiteIcon name="chevron-right" size={16} className="text-[var(--fg-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--brand-text)]" />
            </Link>
          ))}
        </div>

        {user?.role === 'admin' ? (
          <Link
            to="/admin"
            className="mt-6 inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border)] px-4 text-sm font-medium text-[var(--brand-text)] transition hover:border-[var(--brand)]"
          >
            <SiteIcon name="dashboard" size={16} />
            {t('account.openAdmin')}
          </Link>
        ) : null}
      </Container>
    </>
  )
}
