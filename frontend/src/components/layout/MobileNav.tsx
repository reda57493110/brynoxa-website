import { NavLink, useNavigate } from 'react-router-dom'
import { Drawer } from '@/components/ui/Drawer'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { authApi } from '@/api/authApi'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { useThemeStore } from '@/store/themeStore'
import { toast } from '@/store/toastStore'
import { cn } from '@/lib/cn'
import { useT } from '@/hooks/useT'

export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const cartCount = useCartStore((s) => s.itemCount())
  const wishCount = useWishlistStore((s) => s.ids.length)
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const t = useT()

  const links: { to: string; label: string; icon: SiteIconName; end?: boolean; count?: number }[] = [
    { to: '/', label: t('common.home'), icon: 'home', end: true },
    { to: '/shop', label: t('common.shop'), icon: 'search' },
    { to: '/services', label: t('common.services'), icon: 'shield' },
    { to: '/contact', label: t('common.contact'), icon: 'mail' },
    { to: '/wishlist', label: t('common.wishlist'), icon: 'heart', count: wishCount },
    { to: '/cart', label: t('common.cart'), icon: 'cart', count: cartCount },
    {
      to: user ? '/account' : '/login',
      label: user ? t('common.account') : t('common.signIn'),
      icon: 'user',
    },
  ]

  const signOut = async () => {
    onClose()
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
    <Drawer open={open} onClose={onClose} title="Brynoxa" side="left">
      <nav className="flex flex-col gap-1" aria-label={t('nav.mobile')}>
        {links.map(({ to, label, icon, end, count }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex min-h-12 items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition',
                isActive
                  ? 'bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand-text)]'
                  : 'hover:bg-[var(--bg-muted)]'
              )
            }
          >
            <SiteIcon name={icon} size={20} />
            <span className="flex-1">{label}</span>
            {count ? (
              <span className="rounded-full bg-[var(--brand)] px-2 py-0.5 text-[11px] font-bold text-[var(--brand-fg)]">
                {count}
              </span>
            ) : null}
          </NavLink>
        ))}

        <div className="mt-4 space-y-2 border-t border-[var(--border)] pt-4">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition hover:bg-[var(--bg-muted)]"
          >
            <SiteIcon name={theme === 'dark' ? 'sun' : 'moon'} size={20} />
            <span className="flex-1 text-start">
              {theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
            </span>
          </button>
          <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl px-3 py-2">
            <span className="text-sm font-medium text-[var(--fg-muted)]">{t('nav.language')}</span>
            <LanguageSwitcher />
          </div>
          {user ? (
            <button
              type="button"
              onClick={signOut}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-[var(--danger)] transition hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]"
            >
              <SiteIcon name="logout" size={20} />
              <span className="flex-1 text-start">{t('common.signOut')}</span>
            </button>
          ) : null}
        </div>

        {user?.role === 'admin' ? (
          <NavLink
            to="/admin"
            onClick={onClose}
            className="mt-4 rounded-xl bg-[var(--brand)] px-3 py-3 text-center text-sm font-semibold text-[var(--brand-fg)]"
          >
            {t('common.adminDashboard')}
          </NavLink>
        ) : null}
      </nav>
    </Drawer>
  )
}
