import { Link } from 'react-router-dom'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { Container } from '@/components/ui/Container'
import { PageHero } from '@/components/layout/PageHero'
import { surfaceCard } from '@/components/layout/pageStyles'
import { useAuthStore } from '@/store/authStore'
import { usePageTitle } from '@/hooks/usePageTitle'

const links: { to: string; label: string; desc: string; icon: SiteIconName }[] = [
  { to: '/account/orders', label: 'Orders', desc: 'Track COD shipments', icon: 'package' },
  { to: '/wishlist', label: 'Wishlist', desc: 'Saved products', icon: 'heart' },
  { to: '/account/reviews', label: 'Reviews', desc: 'Your product feedback', icon: 'star' },
  { to: '/account/settings', label: 'Settings', desc: 'Profile & addresses', icon: 'settings' },
]

export function Account() {
  usePageTitle('Account — Brynoxa')
  const user = useAuthStore((s) => s.user)

  return (
    <>
      <PageHero
        kicker="Account"
        title="Account"
        description={`Signed in${user?.name ? ` as ${user.name}` : ''}. Orders, wishlist, and delivery details.`}
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
            Open admin dashboard
          </Link>
        ) : null}
      </Container>
    </>
  )
}
