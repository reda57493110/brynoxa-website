import { useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useT } from '@/hooks/useT'
import { cn } from '@/lib/cn'
import type { Product } from '@/types'
import { HomeShopCard, type CardBadge } from './HomeShopCard'

/**
 * A section title in the shop style: a cyan bar, the title in capitals, an optional line under
 * it, and "View all ›" on the other side.
 */
export function HomeSectionHead({
  id,
  title,
  body,
  viewAll,
  className,
}: {
  id: string
  title: string
  body?: string
  viewAll?: { to: string; label: string }
  className?: string
}) {
  return (
    <div className={cn('mb-3 flex items-end justify-between gap-3 sm:mb-5', className)}>
      <div className="min-w-0">
        <h2 id={id} className="flex items-center gap-2 font-display text-[15px] font-extrabold uppercase tracking-tight sm:gap-2.5 sm:text-[1.75rem]">
          <span className="h-4 w-1 shrink-0 -skew-x-12 rounded-sm bg-[var(--brand)] shadow-[0_0_12px_rgb(0_194_255/0.7)] sm:h-7 sm:w-2" aria-hidden="true" />
          {title}
        </h2>
        {body ? <p className="mt-1 hidden text-sm text-[var(--fg-muted)] sm:block">{body}</p> : null}
      </div>
      {viewAll ? (
        <Link to={viewAll.to} className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[var(--brand-text)] hover:underline sm:text-sm">
          {viewAll.label}
          <SiteIcon name="chevron-right" size={15} className="rtl:rotate-180" />
        </Link>
      ) : null}
    </div>
  )
}

/** Card widths: two on a phone, three on a tablet, four or five on a computer */
export const SHELF_CARD = 'w-[calc((100%-0.625rem)/2)] shrink-0 snap-start sm:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-3rem)/4)]'

/**
 * A row of product cards you scroll sideways (finger, trackpad or the ‹ › buttons). It never
 * moves by itself. `lead`: a promo card shown first, in the row.
 */
export function HomeShelf({ products, badge, lead, label }: { products: Product[]; badge?: (p: Product) => CardBadge; lead?: ReactNode; label: string }) {
  const t = useT()
  const track = useRef<HTMLUListElement>(null)
  const move = (dir: 1 | -1) => {
    const el = track.current
    if (!el) return
    const rtl = getComputedStyle(el).direction === 'rtl'
    el.scrollBy({ left: dir * (rtl ? -1 : 1) * el.clientWidth * 0.9, behavior: 'smooth' })
  }
  return (
    <div className="relative">
      <ul
        ref={track}
        aria-label={label}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:gap-4 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {lead ? <li className={SHELF_CARD}>{lead}</li> : null}
        {products.map((p, i) => (
          <li key={p._id} className={SHELF_CARD}>
            <HomeShopCard product={p} badge={badge ? badge(p) : null} eager={i < 2} />
          </li>
        ))}
      </ul>
      {products.length + (lead ? 1 : 0) > 2 ? (
        <>
          <button
            type="button"
            onClick={() => move(-1)}
            aria-label={t('home.scrollPrev')}
            className="absolute -start-4 top-[38%] z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg)] shadow-soft transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] sm:grid"
          >
            <SiteIcon name="chevron-left" size={18} className="rtl:rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            aria-label={t('home.scrollNext')}
            className="absolute -end-4 top-[38%] z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg)] shadow-soft transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] sm:grid"
          >
            <SiteIcon name="chevron-right" size={18} className="rtl:rotate-180" />
          </button>
        </>
      ) : null}
    </div>
  )
}

/** Same grid of cards, no scrolling: 2 / 3 / 4 / 5 a row */
export function HomeGrid({ products, badge }: { products: Product[]; badge?: (p: Product) => CardBadge }) {
  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((p, i) => (
        // Phones: two rows of two
        <li key={p._id} className={i >= 4 ? 'max-sm:hidden' : undefined}>
          <HomeShopCard product={p} badge={badge ? badge(p) : null} />
        </li>
      ))}
    </ul>
  )
}
