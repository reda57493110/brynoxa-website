import { Link, useNavigate } from 'react-router-dom'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { Button } from '@/components/ui/Button'
import { Container } from '@/components/ui/Container'
import { PageHero } from '@/components/layout/PageHero'
import { surfaceCard } from '@/components/layout/pageStyles'
import { authApi } from '@/api/authApi'
import { isStaffRole, staffHomePath } from '@/lib/permissions'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useT } from '@/hooks/useT'

export function Account() {
  const t = useT()
  usePageTitle(t('account.title'))
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const links: { to: string; label: string; desc: string; icon: SiteIconName }[] = [
    { to: '/account/orders', label: t('account.orders'), desc: t('account.ordersDesc'), icon: 'package' },
    { to: '/wishlist', label: t('account.wishlist'), desc: t('account.wishlistDesc'), icon: 'heart' },
    { to: '/account/reviews', label: t('account.reviews'), desc: t('account.reviewsDesc'), icon: 'star' },
    { to: '/account/notifications', label: t('notifications.heading'), desc: t('notifications.body'), icon: 'inbox' },
    { to: '/account/settings', label: t('account.settings'), desc: t('account.settingsDesc'), icon: 'settings' },
  ]

  const signOut = async () => {
    try {
      await authApi.logout()
    } catch {
      /* cookie may already be gone */
    }
    logout()
    toast.success(t('auth.signedOut'))
    navigate('/', { replace: true })
  }

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
        <div className="mb-6 flex flex-wrap gap-3">
          <Link
            to="/shop"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 ring-brand"
          >
            {t('account.continueShopping')}
          </Link>
          <Button type="button" variant="outline" className="rounded-full" onClick={signOut}>
            <SiteIcon name="logout" size={16} />
            {t('common.signOut')}
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {links.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`${surfaceCard} group flex items-center gap-4 p-5 transition hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-soft-lg`}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[var(--brand-text)]">
                <SiteIcon name={item.icon} size={20} />
              </span>
              <span className="flex-1">
                <span className="block font-display font-semibold">{item.label}</span>
                <span className="text-sm text-[var(--fg-muted)]">{item.desc}</span>
              </span>
              <SiteIcon
                name="chevron-right"
                size={16}
                className="text-[var(--fg-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--brand-text)]"
              />
            </Link>
          ))}
        </div>

        {isStaffRole(user?.role) ? (
          <Link
            to={staffHomePath(user?.role)}
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
