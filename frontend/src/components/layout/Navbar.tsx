import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useThemeStore } from '@/store/themeStore'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { useCompareStore } from '@/store/compareStore'
import { useAuthStore } from '@/store/authStore'
import { MobileNav } from './MobileNav'
import { LanguageSwitcher } from './LanguageSwitcher'
import { cn } from '@/lib/cn'
import { useT } from '@/hooks/useT'

const iconBtn =
  'inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--fg)] transition hover:bg-[var(--bg-muted)] ring-brand'

export function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [q, setQ] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const mobileSearchRef = useRef<HTMLInputElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const isHome = location.pathname === '/'
  const atTop = isHome && !scrolled

  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const cartCount = useCartStore((s) => s.itemCount())
  const wishCount = useWishlistStore((s) => s.ids.length)
  const compareCount = useCompareStore((s) => s.items.length)
  const user = useAuthStore((s) => s.user)
  const t = useT()
  const links = [
    { to: '/shop', label: t('common.shop') },
    { to: '/services', label: t('common.services') },
    { to: '/contact', label: t('common.contact') },
  ]

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setSearchOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault()
        if (window.matchMedia('(min-width: 768px)').matches) {
          searchRef.current?.focus()
        } else {
          setSearchOpen(true)
        }
      }
      if (e.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (searchOpen) mobileSearchRef.current?.focus()
  }, [searchOpen])

  const onSearch = (e: FormEvent) => {
    e.preventDefault()
    const query = q.trim()
    navigate(query ? `/search?q=${encodeURIComponent(query)}` : '/shop')
    setSearchOpen(false)
  }

  return (
    <>
      <header className="sticky top-0 z-50 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-8 sm:pt-3 lg:px-12">
        <div
          className={cn(
            'mx-auto flex w-full max-w-5xl flex-col rounded-2xl border transition-all duration-300',
            atTop
              ? 'border-[var(--border)] bg-[var(--bg-elevated)] shadow-soft dark:border-white/10 dark:bg-black/25 dark:backdrop-blur-xl'
              : 'border-[var(--glass-border)] bg-[var(--glass)] backdrop-blur-xl'
          )}
        >
          <div className="flex h-12 items-center gap-1 px-1.5 sm:h-14 sm:gap-3 sm:px-3">
            <button
              type="button"
              className={cn(iconBtn, 'lg:hidden')}
              onClick={() => setMenuOpen(true)}
              aria-label={t('nav.openMenu')}
            >
              <SiteIcon name="menu" size={18} />
            </button>

            <Link
              to="/"
              className="min-w-0 shrink truncate px-1 font-display text-base font-bold tracking-tight sm:px-1.5 sm:text-xl"
            >
              Brynox<span className="text-[var(--brand)]">a</span>
            </Link>

            <nav className="ml-1 hidden items-center gap-0.5 lg:flex" aria-label={t('nav.primary')}>
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={({ isActive }) =>
                    cn(
                      'rounded-full px-3.5 py-1.5 text-sm font-medium transition',
                      isActive
                        ? 'bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] text-[var(--brand-text)]'
                        : 'text-[var(--fg)]/75 hover:bg-[var(--bg-muted)] hover:text-[var(--fg)] dark:text-[var(--fg-muted)] dark:hover:text-[var(--fg)]'
                    )
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>

            <form onSubmit={onSearch} className="hidden min-w-0 max-w-md flex-1 md:block md:ml-4">
              <label className="relative block">
                <span className="sr-only">{t('common.search')}</span>
                <SiteIcon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
                <input
                  ref={searchRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t('common.searchPlaceholder')}
                  className="h-9 w-full rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] ps-9 pe-12 text-sm text-[var(--fg)] placeholder:text-[var(--fg-muted)] outline-none ring-brand dark:bg-[var(--bg-input)]"
                />
                <kbd className="pointer-events-none absolute end-2.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-[var(--border)] bg-[var(--bg-muted)] px-1.5 py-px text-[10px] font-medium text-[var(--fg-muted)] lg:inline">
                  /
                </kbd>
              </label>
            </form>

            <div className="ml-auto flex items-center gap-0 md:ml-1">
              <button
                type="button"
                className={cn(iconBtn, 'md:hidden')}
                onClick={() => setSearchOpen((open) => !open)}
                aria-label={searchOpen ? t('nav.closeSearch') : t('nav.openSearch')}
                aria-expanded={searchOpen}
              >
                {searchOpen ? <SiteIcon name="close" size={18} /> : <SiteIcon name="search" size={18} />}
              </button>

              <button
                type="button"
                className={cn(iconBtn, 'hidden sm:inline-flex')}
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}
              >
                {theme === 'dark' ? <SiteIcon name="sun" size={17} /> : <SiteIcon name="moon" size={17} />}
              </button>

              <LanguageSwitcher className="hidden sm:inline-flex" />

              <Link
                to="/wishlist"
                className={cn(iconBtn, 'relative hidden sm:inline-flex')}
                aria-label={t('common.wishlist')}
              >
                <SiteIcon name="heart" size={17} />
                {wishCount > 0 ? (
                  <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-bold text-[var(--brand-fg)]">
                    {wishCount}
                  </span>
                ) : null}
              </Link>

              <Link
                to="/compare"
                className={cn(iconBtn, 'relative hidden sm:inline-flex')}
                aria-label={t('compare.heading')}
              >
                <SiteIcon name="layers" size={17} />
                {compareCount > 0 ? (
                  <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[10px] font-bold text-[var(--brand-fg)]">
                    {compareCount}
                  </span>
                ) : null}
              </Link>

              <Link
                to="/cart"
                className={cn(
                  'relative inline-flex h-9 items-center justify-center gap-1 rounded-full px-2 transition ring-brand sm:gap-1.5 sm:px-2.5',
                  cartCount > 0
                    ? 'bg-[var(--brand)] text-[var(--brand-fg)] hover:brightness-110'
                    : 'text-[var(--fg)] hover:bg-[var(--bg-muted)]'
                )}
                aria-label={cartCount > 0 ? t('nav.cartItems', { count: cartCount }) : t('common.cart')}
              >
                <SiteIcon name="cart" size={17} />
                {cartCount > 0 ? (
                  <span className="text-xs font-semibold tabular-nums">{cartCount}</span>
                ) : null}
              </Link>

              {user ? (
                <Link to="/account" className={cn(iconBtn, 'hidden sm:inline-flex')} aria-label={t('common.account')}>
                  <SiteIcon name="user" size={17} />
                </Link>
              ) : (
                <Link
                  to="/login"
                  className="ml-0.5 hidden h-9 items-center rounded-full bg-[var(--brand)] px-3.5 text-sm font-semibold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 sm:inline-flex"
                >
                  {t('common.signIn')}
                </Link>
              )}
            </div>
          </div>

          {searchOpen ? (
            <form onSubmit={onSearch} className="border-t border-[var(--border)] px-3 py-2.5 md:hidden">
              <label className="relative block">
                <span className="sr-only">{t('common.search')}</span>
                <SiteIcon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
                <input
                  ref={mobileSearchRef}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t('common.searchPlaceholder')}
                  className="h-10 w-full rounded-full border border-[var(--border)] bg-[var(--bg-input)] ps-9 pe-3 text-sm text-[var(--fg)] placeholder:text-[var(--fg-muted)] outline-none ring-brand"
                />
              </label>
            </form>
          ) : null}
        </div>
      </header>
      <MobileNav open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  )
}
