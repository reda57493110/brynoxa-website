import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { ProductCarousel } from '@/components/product/ProductCarousel'
import { useT } from '@/hooks/useT'
import { useLocaleStore } from '@/store/localeStore'
import { cn } from '@/lib/cn'
import type { Product } from '@/types'
import { bestDiscount, latestAdded } from '@/lib/homeRows'

/** Fewer than this and the row stays hidden (no half-empty rows). */
export const HOME_ROW_MIN = 4

const LOCALE_TAG = { en: 'en-GB', fr: 'fr-MA', ar: 'ar-MA' } as const

function Stat({ icon, children, strong }: { icon: SiteIconName; children: ReactNode; strong?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[10.5px] font-semibold sm:h-8 sm:gap-1.5 sm:px-3 sm:text-[13px]',
        strong
          ? 'border-transparent bg-[var(--brand)] text-[var(--brand-fg)] shadow-glow'
          : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg)]'
      )}
    >
      <SiteIcon name={icon} size={13} />
      {children}
    </span>
  )
}

/**
 * A home page product row (Deals, New arrivals) in its own panel: the Featured heading (kicker,
 * title, text, view-all button), facts worked out from the real products (best discount, how
 * many, latest date) and a product carousel. Hidden while it has fewer than 4 products.
 */
export function HomeProductRow({
  id,
  tone,
  icon,
  kicker,
  title,
  body,
  viewAll,
  products,
}: {
  id: string
  tone: 'deals' | 'new'
  icon: SiteIconName
  kicker: string
  title: string
  body: string
  viewAll: { to: string; label: string }
  products: Product[]
}) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  if (products.length < HOME_ROW_MIN) return null
  const headingId = `home-${id}-heading`
  const discount = tone === 'deals' ? bestDiscount(products) : 0
  const latest = tone === 'new' ? latestAdded(products) : null

  return (
    <section id={id} aria-labelledby={headingId} className="py-4 sm:py-8">
      <Container>
        <div
          className={cn(
            'relative overflow-hidden rounded-[1.25rem] border p-3 shadow-soft sm:rounded-[2rem] sm:p-7',
            tone === 'deals'
              ? 'border-[color-mix(in_srgb,var(--brand)_35%,var(--border))] bg-[radial-gradient(80%_120%_at_0%_0%,color-mix(in_srgb,var(--brand)_16%,transparent),transparent_60%),radial-gradient(60%_90%_at_100%_100%,color-mix(in_srgb,var(--brand)_8%,transparent),transparent_60%)] bg-[var(--bg-elevated)]'
              : 'border-[var(--border)] bg-[var(--bg-elevated)]'
          )}
        >
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2.5 sm:mb-6 sm:gap-4">
            <div className="max-w-xl">
              <p className="kicker inline-flex items-center gap-1.5">
                <SiteIcon name={icon} size={13} />
                {kicker}
              </p>
              <h2 id={headingId} className="mt-1 font-display text-lg font-semibold leading-tight tracking-tight sm:mt-2 sm:text-4xl">
                {title}
              </h2>
              <p className="mt-1 text-[12.5px] leading-snug text-[var(--fg-muted)] sm:mt-2 sm:text-base sm:leading-relaxed">{body}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
                {discount > 0 ? (
                  <Stat icon="tag" strong>
                    {t('home.upTo', { percent: discount })}
                  </Stat>
                ) : null}
                <Stat icon={tone === 'deals' ? 'ticket' : 'package'}>
                  {t(tone === 'deals' ? 'home.dealsCount' : 'home.newCount', { count: products.length })}
                </Stat>
                {latest ? (
                  <Stat icon="clock">
                    {t('home.latestAdded', {
                      date: new Intl.DateTimeFormat(LOCALE_TAG[locale], { day: 'numeric', month: 'short' }).format(latest),
                    })}
                  </Stat>
                ) : null}
              </div>
            </div>
            <Link
              to={viewAll.to}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition sm:h-10 sm:gap-2 sm:px-4 sm:text-sm',
                tone === 'deals'
                  ? 'bg-[var(--brand)] text-[var(--brand-fg)] shadow-glow hover:brightness-110'
                  : 'border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] hover:border-[var(--brand)] hover:text-[var(--brand-text)]'
              )}
            >
              {viewAll.label}
              <SiteIcon name="arrow-right" size={16} className="rtl:rotate-180" />
            </Link>
          </div>
          <ProductCarousel products={products} size={tone === 'new' ? 'lg' : 'md'} />
        </div>
      </Container>
    </section>
  )
}
