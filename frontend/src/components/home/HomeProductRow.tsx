import { Link } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { ProductCarousel } from '@/components/product/ProductCarousel'
import type { Product } from '@/types'

/** Fewer than this and the row stays hidden (no half-empty rows). */
export const HOME_ROW_MIN = 4

/**
 * A home page product row (Deals, New arrivals): the same heading as Featured (kicker, title,
 * text, "view all" button) and a product carousel. Hidden while it has fewer than 4 products.
 */
export function HomeProductRow({
  id,
  icon,
  kicker,
  title,
  body,
  viewAll,
  products,
}: {
  id: string
  icon: SiteIconName
  kicker: string
  title: string
  body: string
  viewAll: { to: string; label: string }
  products: Product[]
}) {
  if (products.length < HOME_ROW_MIN) return null
  const headingId = `home-${id}-heading`
  return (
    <section id={id} aria-labelledby={headingId} className="py-8 sm:py-10">
      <Container>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <p className="kicker inline-flex items-center gap-1.5">
              <SiteIcon name={icon} size={13} />
              {kicker}
            </p>
            <h2 id={headingId} className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-4xl">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)] sm:text-base">{body}</p>
          </div>
          <Link
            to={viewAll.to}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-4 text-sm font-medium text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
          >
            {viewAll.label}
            <SiteIcon name="arrow-right" size={16} className="rtl:rotate-180" />
          </Link>
        </div>
        <ProductCarousel products={products} />
      </Container>
    </section>
  )
}
