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
        'inline-flex h-6 items-center gap-1 rounded-full px-2 text-[10.5px] font-semibold sm:h-7 sm:gap-1.5 sm:px-2.5 sm:text-xs',
        strong ? 'bg-[var(--brand)] text-[var(--brand-fg)] shadow-glow' : 'bg-white/[0.08] text-white/85 ring-1 ring-white/12'
      )}
    >
      <SiteIcon name={icon} size={12} />
      {children}
    </span>
  )
}

/**
 * A home "shelf" (Top picks, Deals, New arrivals): a dark Brynoxa panel with the title, a few facts
 * worked out from the real products (best discount, how many, latest date) and the "see all"
 * button, beside a product carousel. On phones the panel is a short header above the carousel.
 * Hidden while it has fewer than `min` products (4 by default).
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
  min = HOME_ROW_MIN,
}: {
  id: string
  tone: 'deals' | 'new' | 'featured'
  icon: SiteIconName
  kicker: string
  title: string
  body: string
  viewAll: { to: string; label: string }
  products: Product[]
  min?: number
}) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  if (products.length < min) return null
  const headingId = `home-${id}-heading`
  const discount = tone === 'deals' ? bestDiscount(products) : 0
  const latest = tone === 'new' ? latestAdded(products) : null

  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-24 py-3 sm:py-6">
      <Container>
        <div className="grid gap-3 sm:gap-4 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-5">
          {/* The panel: always dark, the Brynoxa glow; a big faint icon in the corner */}
          <div
            className={cn(
              'relative isolate flex flex-col overflow-hidden rounded-[1.25rem] border p-4 text-white sm:rounded-[1.75rem] sm:p-6 lg:p-7',
              tone === 'deals'
                ? 'border-[rgb(0_194_255/0.45)] bg-[#060a0d] shadow-[0_24px_60px_-30px_rgb(0_194_255/0.6)]'
                : 'border-[rgb(0_194_255/0.22)] bg-[#0a0f14]'
            )}
          >
            <div
              className={cn(
                'pointer-events-none absolute inset-0 -z-10',
                tone === 'deals'
                  ? 'bg-[radial-gradient(90%_70%_at_0%_0%,rgb(0_194_255/0.32),transparent_60%),radial-gradient(70%_60%_at_100%_100%,rgb(0_194_255/0.16),transparent_60%)]'
                  : 'bg-[radial-gradient(90%_70%_at_0%_0%,rgb(0_194_255/0.18),transparent_60%)]'
              )}
              aria-hidden="true"
            />
            <SiteIcon
              name={icon}
              size={150}
              className="pointer-events-none absolute -bottom-8 -end-8 -z-10 hidden rotate-[-12deg] text-[rgb(0_194_255/0.09)] lg:block"
            />
            {void kicker}
            <div className="flex items-start justify-between gap-3 lg:block">
              <div className="min-w-0">
                <span className="hidden size-11 place-items-center rounded-2xl bg-[rgb(0_194_255/0.16)] text-[var(--brand)] ring-1 ring-[rgb(0_194_255/0.35)] lg:grid">
                  <SiteIcon name={icon} size={20} />
                </span>
                <h2 id={headingId} className="font-display text-lg font-extrabold uppercase leading-[1.05] tracking-tight sm:text-3xl lg:mt-5 lg:text-[2rem]">
                  {title}
                </h2>
                <p className="mt-1 text-[12px] leading-snug text-white/65 sm:mt-2 sm:text-sm sm:leading-relaxed">{body}</p>
              </div>
              {/* Phones / tablets: the button sits beside the title */}
              <Link
                to={viewAll.to}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-[var(--brand)] px-3 text-xs font-bold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 sm:h-10 sm:px-4 sm:text-sm lg:hidden"
              >
                {viewAll.label}
                <SiteIcon name="arrow-right" size={15} className="rtl:rotate-180" />
              </Link>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5 sm:mt-4">
              {discount > 0 ? (
                <Stat icon="tag" strong>
                  {t('home.upTo', { percent: discount })}
                </Stat>
              ) : null}
              <Stat icon={tone === 'deals' ? 'ticket' : tone === 'new' ? 'package' : 'star'}>
                {t(tone === 'deals' ? 'home.dealsCount' : tone === 'new' ? 'home.newCount' : 'home.picksCount', { count: products.length })}
              </Stat>
              {latest ? (
                <Stat icon="clock">
                  {t('home.latestAdded', {
                    date: new Intl.DateTimeFormat(LOCALE_TAG[locale], { day: 'numeric', month: 'short' }).format(latest),
                  })}
                </Stat>
              ) : null}
            </div>
            <Link
              to={viewAll.to}
              className="mt-auto hidden h-11 w-fit items-center gap-2 rounded-full bg-[var(--brand)] px-5 text-sm font-bold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 lg:mt-8 lg:inline-flex"
            >
              {viewAll.label}
              <SiteIcon name="arrow-right" size={16} className="rtl:rotate-180" />
            </Link>
          </div>

          <div className="min-w-0 self-center">
            <ProductCarousel products={products} />
          </div>
        </div>
      </Container>
    </section>
  )
}
