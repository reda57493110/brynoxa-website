import { Link } from 'react-router-dom'
import { Container } from '@/components/ui/Container'

export function Footer() {
  return (
    <footer className="mt-auto border-t border-[var(--border)] bg-[var(--bg-elevated)]">
      <Container className="grid gap-8 py-12 md:grid-cols-3">
        <div>
          <p className="font-display text-xl font-bold">
            Brynox<span className="text-[var(--brand)]">a</span>
          </p>
          <p className="mt-3 max-w-xs text-sm text-[var(--fg-muted)]">
            Precision tech and lifestyle essentials, curated for people who care about craft.
          </p>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold">Explore</p>
          <div className="flex flex-col gap-2 text-sm text-[var(--fg-muted)]">
            <Link to="/shop" className="hover:text-[var(--brand)]">
              Shop
            </Link>
            <Link to="/wishlist" className="hover:text-[var(--brand)]">
              Wishlist
            </Link>
            <Link to="/compare" className="hover:text-[var(--brand)]">
              Compare
            </Link>
          </div>
        </div>
        <div>
          <p className="mb-3 text-sm font-semibold">Account</p>
          <div className="flex flex-col gap-2 text-sm text-[var(--fg-muted)]">
            <Link to="/account" className="hover:text-[var(--brand)]">
              My account
            </Link>
            <Link to="/account/orders" className="hover:text-[var(--brand)]">
              Orders
            </Link>
            <Link to="/login" className="hover:text-[var(--brand)]">
              Sign in
            </Link>
          </div>
        </div>
      </Container>
      <div className="border-t border-[var(--border)] py-4 text-center text-xs text-[var(--fg-muted)]">
        © {new Date().getFullYear()} Brynoxa. All rights reserved.
      </div>
    </footer>
  )
}
