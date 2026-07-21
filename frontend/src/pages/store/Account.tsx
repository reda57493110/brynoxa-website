import { Link } from 'react-router-dom'
import { Package, Heart, Settings, Star, ChevronRight } from 'lucide-react'
import { Container } from '@/components/ui/Container'
import { useAuthStore } from '@/store/authStore'

const links = [
  { to: '/account/orders', label: 'Orders', desc: 'Track COD shipments', icon: Package },
  { to: '/wishlist', label: 'Wishlist', desc: 'Saved products', icon: Heart },
  { to: '/account/reviews', label: 'Reviews', desc: 'Your product feedback', icon: Star },
  { to: '/account/settings', label: 'Settings', desc: 'Profile & addresses', icon: Settings },
]

export function Account() {
  const user = useAuthStore((s) => s.user)

  return (
    <Container className="py-10">
      <h1 className="font-display text-3xl font-semibold">Account</h1>
      <p className="mt-1 text-[var(--fg-muted)]">
        Welcome back{user?.name ? `, ${user.name}` : ''}
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {links.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="group flex items-center gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 transition hover:border-[var(--brand)]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--bg-muted)] text-[var(--brand)]">
              <item.icon className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block font-semibold">{item.label}</span>
              <span className="text-sm text-[var(--fg-muted)]">{item.desc}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-[var(--fg-muted)] transition group-hover:text-[var(--brand)]" />
          </Link>
        ))}
      </div>

      {user?.role === 'admin' && (
        <Link
          to="/admin"
          className="mt-6 inline-flex rounded-xl border border-[var(--brand)] px-4 py-2 text-sm font-medium text-[var(--brand)] hover:bg-[var(--brand)] hover:text-[var(--brand-fg)]"
        >
          Open admin dashboard
        </Link>
      )}
    </Container>
  )
}
