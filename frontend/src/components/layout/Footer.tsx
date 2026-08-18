import { Link } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { SocialGlyph } from '@/components/contact/BrandIcons'
import { CONTACT, SOCIAL_LINKS, TAGLINE } from '@/lib/site'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/cn'

const explore = [
  { to: '/shop', label: 'Shop' },
  { to: '/services', label: 'Services' },
  { to: '/contact', label: 'Contact' },
  { to: '/wishlist', label: 'Wishlist' },
] as const

const support = [
  { to: '/services#warranty', label: 'Warranty' },
  { to: '/services#returns', label: 'Returns' },
  { to: '/services#cod', label: 'Cash on delivery' },
  { to: '/account/orders', label: 'Track order' },
] as const

const linkClass =
  'rounded-sm text-sm text-[var(--fg-muted)] transition hover:text-[var(--brand-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]'

function FooterHeading({ children }: { children: string }) {
  return (
    <p className="font-display text-sm font-semibold tracking-tight text-[var(--fg)]">{children}</p>
  )
}

export function Footer() {
  const user = useAuthStore((s) => s.user)

  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--bg-elevated)]">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_1fr_1fr_minmax(0,1.15fr)] lg:gap-8">
        <div>
          <Link
            to="/"
            className="font-display text-xl font-bold tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
          >
            Brynox<span className="text-[var(--brand)]">a</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-[var(--fg-muted)]">
            {TAGLINE}
          </p>
          <div className="mt-5 flex flex-wrap gap-2" aria-label="Social">
            {SOCIAL_LINKS.map((s) => (
                <a
                  key={s.id}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${s.name} — opens in a new tab`}
                  className={cn(
                    'inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)]',
                    'transition hover:border-[var(--brand)] hover:text-[var(--brand-text)]',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]'
                  )}
                >
                  <SocialGlyph id={s.id} size={15} />
                </a>
              ))}
          </div>
        </div>

        <nav aria-label="Explore">
          <FooterHeading>Explore</FooterHeading>
          <ul className="mt-4 flex flex-col gap-2.5">
            {explore.map((item) => (
              <li key={item.label}>
                <Link to={item.to} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Support">
          <FooterHeading>Support</FooterHeading>
          <ul className="mt-4 flex flex-col gap-2.5">
            {support.map((item) => (
              <li key={item.label}>
                <Link to={item.to} className={linkClass}>
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              {user ? (
                <Link to="/account" className={linkClass}>
                  My account
                </Link>
              ) : (
                <Link to="/login" className={linkClass}>
                  Sign in
                </Link>
              )}
            </li>
          </ul>
        </nav>

        <div>
          <FooterHeading>Contact</FooterHeading>
          <ul className="mt-4 flex flex-col gap-3 text-sm">
            <li>
              <a href={CONTACT.whatsapp.href} className={cn(linkClass, 'inline-flex items-center gap-2')}>
                <SiteIcon name="chat" size={14} />
                {CONTACT.whatsapp.value}
              </a>
            </li>
            <li>
              <a href={CONTACT.phone.href} className={cn(linkClass, 'inline-flex items-center gap-2')}>
                <SiteIcon name="phone" size={14} />
                {CONTACT.phone.value}
              </a>
            </li>
            <li>
              <a href={CONTACT.email.href} className={cn(linkClass, 'inline-flex items-center gap-2')}>
                <SiteIcon name="mail" size={14} />
                {CONTACT.email.value}
              </a>
            </li>
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-[var(--fg-muted)]">{CONTACT.hours.value}</p>
        </div>
      </Container>

      <div className="border-t border-[var(--border)]">
        <Container className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--fg-muted)]">
            © {new Date().getFullYear()} Brynoxa. Cash on delivery across Morocco.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--fg-muted)]">
            <span>6-month warranty</span>
            <span className="hidden h-1 w-1 rounded-full bg-[var(--border)] sm:inline" aria-hidden="true" />
            <span>No card needed</span>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="inline-flex items-center gap-1 rounded-sm font-medium text-[var(--brand-text)] transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:ml-2"
            >
              Back to top
              <SiteIcon name="arrow-up" size={12} />
            </button>
          </div>
        </Container>
      </div>
    </footer>
  )
}
