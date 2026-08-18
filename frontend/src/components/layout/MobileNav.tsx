import { NavLink } from 'react-router-dom'
import { Drawer } from '@/components/ui/Drawer'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { cn } from '@/lib/cn'

export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useAuthStore((s) => s.user)
  const cartCount = useCartStore((s) => s.itemCount())
  const wishCount = useWishlistStore((s) => s.ids.length)

  const links: { to: string; label: string; icon: SiteIconName; end?: boolean; count?: number }[] = [
    { to: '/', label: 'Home', icon: 'home', end: true },
    { to: '/shop', label: 'Shop', icon: 'search' },
    { to: '/services', label: 'Services', icon: 'shield' },
    { to: '/contact', label: 'Contact', icon: 'mail' },
    { to: '/wishlist', label: 'Wishlist', icon: 'heart', count: wishCount },
    { to: '/cart', label: 'Cart', icon: 'cart', count: cartCount },
    {
      to: user ? '/account' : '/login',
      label: user ? 'Account' : 'Sign in',
      icon: 'user',
    },
  ]

  return (
    <Drawer open={open} onClose={onClose} title="Brynoxa" side="left">
      <nav className="flex flex-col gap-1" aria-label="Mobile">
        {links.map(({ to, label, icon, end, count }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition',
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
        {user?.role === 'admin' ? (
          <NavLink
            to="/admin"
            onClick={onClose}
            className="mt-4 rounded-xl bg-[var(--brand)] px-3 py-3 text-center text-sm font-semibold text-[var(--brand-fg)]"
          >
            Admin dashboard
          </NavLink>
        ) : null}
      </nav>
    </Drawer>
  )
}
