import { useState, type FormEvent } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  GitCompareArrows,
  Heart,
  Menu,
  Moon,
  Search,
  ShoppingBag,
  Sun,
  User,
} from 'lucide-react'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { useThemeStore } from '@/store/themeStore'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { useCompareStore } from '@/store/compareStore'
import { useAuthStore } from '@/store/authStore'
import { MobileNav } from './MobileNav'
import { cn } from '@/lib/cn'

const links = [
  { to: '/shop', label: 'Shop' },
  { to: '/wishlist', label: 'Wishlist' },
  { to: '/compare', label: 'Compare' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const cartCount = useCartStore((s) => s.itemCount())
  const wishCount = useWishlistStore((s) => s.ids.length)
  const compareCount = useCompareStore((s) => s.items.length)
  const user = useAuthStore((s) => s.user)

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    const query = q.trim()
    navigate(query ? `/search?q=${encodeURIComponent(query)}` : '/shop')
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[var(--glass-border)] glass">
        <Container className="flex h-[var(--nav-height)] items-center gap-4">
          <button
            type="button"
            className="rounded-xl p-2 lg:hidden hover:bg-[var(--bg-muted)]"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link to="/" className="font-display text-xl font-bold tracking-tight sm:text-2xl">
            Brynox<span className="text-[var(--brand)]">a</span>
          </Link>

          <nav className="ml-6 hidden items-center gap-1 lg:flex">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-xl px-3 py-2 text-sm font-medium transition',
                    isActive
                      ? 'bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand)]'
                      : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <form onSubmit={onSearch} className="ml-auto hidden max-w-md flex-1 md:flex">
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-muted)]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search products..."
                className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] pl-9 pr-3 text-sm outline-none ring-brand"
              />
            </div>
          </form>

          <div className="ml-auto flex items-center gap-1 md:ml-2">
            <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Link to="/compare" className="relative rounded-xl p-2 hover:bg-[var(--bg-muted)]">
              <GitCompareArrows className="h-5 w-5" />
              {compareCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-bold text-[var(--brand-fg)]">
                  {compareCount}
                </span>
              ) : null}
            </Link>
            <Link to="/wishlist" className="relative rounded-xl p-2 hover:bg-[var(--bg-muted)]">
              <Heart className="h-5 w-5" />
              {wishCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-bold text-[var(--brand-fg)]">
                  {wishCount}
                </span>
              ) : null}
            </Link>
            <Link to="/cart" className="relative rounded-xl p-2 hover:bg-[var(--bg-muted)]">
              <ShoppingBag className="h-5 w-5" />
              {cartCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-bold text-[var(--brand-fg)]">
                  {cartCount}
                </span>
              ) : null}
            </Link>
            <Link
              to={user ? '/account' : '/login'}
              className="rounded-xl p-2 hover:bg-[var(--bg-muted)]"
              aria-label="Account"
            >
              <User className="h-5 w-5" />
            </Link>
          </div>
        </Container>
      </header>
      <MobileNav open={open} onClose={() => setOpen(false)} />
    </>
  )
}
