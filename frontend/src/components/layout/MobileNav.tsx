import { Link } from 'react-router-dom'
import { Heart, Home, Search, ShoppingBag, User } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { useAuthStore } from '@/store/authStore'

export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useAuthStore((s) => s.user)
  const links = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/shop', label: 'Shop', icon: Search },
    { to: '/wishlist', label: 'Wishlist', icon: Heart },
    { to: '/cart', label: 'Cart', icon: ShoppingBag },
    { to: user ? '/account' : '/login', label: user ? 'Account' : 'Sign in', icon: User },
  ]

  return (
    <Drawer open={open} onClose={onClose} title="Menu" side="left">
      <nav className="flex flex-col gap-1">
        {links.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium hover:bg-[var(--bg-muted)]"
          >
            <Icon className="h-5 w-5 text-[var(--brand)]" />
            {label}
          </Link>
        ))}
        {user?.role === 'admin' ? (
          <Link
            to="/admin"
            onClick={onClose}
            className="mt-4 rounded-xl bg-[var(--brand)] px-3 py-3 text-center text-sm font-semibold text-[var(--brand-fg)]"
          >
            Admin Dashboard
          </Link>
        ) : null}
      </nav>
    </Drawer>
  )
}
