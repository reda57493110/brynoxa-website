import { Link } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { Skeleton } from '@/components/ui/Skeleton'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useT } from '@/hooks/useT'
import { categoryIcon } from '@/lib/categoryIcon'
import { isSubCategory } from '@/lib/categoryTree'
import { cn } from '@/lib/cn'
import { categoryDisplayName } from '@/i18n'
import { bestDiscount } from '@/lib/homeRows'
import { useLocaleStore } from '@/store/localeStore'
import type { Category, Product } from '@/types'
import { HomeHeroSlider, HomeHeroSliderSkeleton } from './HomeHeroSlider'

/** A photo tile beside the banner (under it on tablets and phones) */
function PromoTile({ to, photo, kicker, title, cta }: { to: string; photo: string; kicker: string; title: string; cta: string }) {
  return (
    <Link
      to={to}
      className="group relative isolate flex min-h-[6.5rem] flex-col justify-end overflow-hidden rounded-2xl border border-[rgb(0_194_255/0.2)] bg-[#05080b] p-2.5 text-white sm:min-h-[11rem] sm:p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
    >
      <img src={photo} alt="" width={480} height={300} loading="lazy" decoding="async" className="absolute inset-0 -z-20 h-full w-full object-cover transition duration-500 group-hover:scale-[1.06]" />
      <span className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(5_8_11/0.05)_0%,rgb(5_8_11/0.6)_55%,rgb(5_8_11/0.95)_100%)]" aria-hidden="true" />
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--brand)] sm:text-[11px]">{kicker}</span>
      <span className="mt-0.5 font-display text-[13px] font-extrabold uppercase leading-tight sm:text-xl">{title}</span>
      <span className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-semibold text-white/80 transition group-hover:text-[var(--brand)] sm:text-sm">
        {cta}
        <SiteIcon name="chevron-right" size={14} className="rtl:rotate-180" />
      </span>
    </Link>
  )
}

/**
 * Top of the home page, like the big Moroccan PC shops: the "All categories" menu on the left
 * (a row of chips on phones), the deals banner in the middle, two photo tiles on the right.
 */
export function HomeHero({
  deals,
  dealsPending,
  categories,
  categoriesLoading,
  onSale,
}: {
  deals: Product[]
  dealsPending: boolean
  categories: Category[]
  categoriesLoading: boolean
  onSale: Product[]
}) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const off = bestDiscount(onSale)

  const chips = categoriesLoading
    ? Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="shrink-0">
          <Skeleton className="h-9 w-28 rounded-full" />
        </li>
      ))
    : categories.map((c) => (
        <li key={c._id} className="shrink-0">
          <Link
            to={`/category/${c.slug}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 text-[12px] font-semibold text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
          >
            <SiteIcon name={categoryIcon(c.slug, c.name)} size={15} className="text-[var(--brand-text)]" />
            {categoryDisplayName(locale, c.slug, c.name)}
          </Link>
        </li>
      ))

  return (
    <section aria-label={t('home.dealsLabel')} className="pt-2 sm:pt-4">
      <Container>
        {/* Phones / tablets: the categories as a row of chips */}
        <ul aria-label={t('home.allCategories')} className="-mx-4 mb-2.5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mb-4 lg:hidden [&::-webkit-scrollbar]:hidden">
          {chips}
        </ul>

        <div className="grid gap-2.5 sm:gap-4 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_16rem]">
          {/* Computers: the category menu */}
          <nav aria-labelledby="home-all-categories" className="hidden flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] lg:flex">
            <p id="home-all-categories" className="flex items-center gap-2 bg-[var(--brand)] px-4 py-3 text-sm font-extrabold uppercase tracking-wide text-[var(--brand-fg)]">
              <SiteIcon name="menu" size={17} />
              {t('home.allCategories')}
            </p>
            <ul className="flex-1 py-1.5">
              {categoriesLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <li key={i} className="px-4 py-2">
                      <Skeleton className="h-6 rounded-md" />
                    </li>
                  ))
                : categories.map((c) => {
                    const sub = isSubCategory(c, categories)
                    return (
                    <li key={c._id}>
                      <Link
                        to={`/category/${c.slug}`}
                        className={cn(
                          'group flex items-center gap-3 px-4 text-[var(--fg)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--brand-text)]',
                          sub ? 'py-1.5 ps-9 text-[13px] font-medium text-[var(--fg-muted)]' : 'py-2.5 text-sm font-semibold'
                        )}
                      >
                        <span
                          className={cn(
                            'grid shrink-0 place-items-center rounded-lg bg-[var(--bg-muted)] text-[var(--brand-text)] transition group-hover:bg-[var(--brand)] group-hover:text-[var(--brand-fg)]',
                            sub ? 'size-6' : 'size-8'
                          )}
                        >
                          <SiteIcon name={categoryIcon(c.slug, c.name)} size={sub ? 13 : 16} />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{categoryDisplayName(locale, c.slug, c.name)}</span>
                        <SiteIcon name="chevron-right" size={14} className="text-[var(--fg-muted)] rtl:rotate-180" />
                      </Link>
                    </li>
                    )
                  })}
            </ul>
            <Link to="/shop" className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 text-sm font-bold text-[var(--brand-text)] hover:bg-[var(--bg-muted)]">
              {t('home.seeMoreCategories')}
              <SiteIcon name="arrow-right" size={15} className="rtl:rotate-180" />
            </Link>
          </nav>

          {/* The deals banner */}
          <div data-rise className="min-w-0 lg:min-h-[28rem]">
            {deals.length ? (
              <HomeHeroSlider products={deals} />
            ) : dealsPending ? (
              <HomeHeroSliderSkeleton />
            ) : (
              <Link
                to="/shop"
                className="relative isolate flex h-full min-h-[14rem] flex-col justify-end overflow-hidden rounded-[1.5rem] border border-[rgb(0_194_255/0.28)] bg-[#05080b] p-6 text-white sm:rounded-[2rem] sm:p-10"
              >
                <img src="/categories/gaming-pcs.webp" alt="" width={960} height={600} className="absolute inset-0 -z-20 h-full w-full object-cover" />
                <span className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(5_8_11/0.95),rgb(5_8_11/0.3))] rtl:bg-[linear-gradient(270deg,rgb(5_8_11/0.95),rgb(5_8_11/0.3))]" aria-hidden="true" />
                <span className="font-display text-2xl font-extrabold uppercase sm:text-4xl">{t('home.featuredTitle')}</span>
                <span className="mt-3 inline-flex w-fit items-center gap-2 rounded-full bg-[var(--brand)] px-5 py-2.5 text-sm font-bold text-[var(--brand-fg)]">
                  {t('home.browseShop')}
                  <SiteIcon name="arrow-right" size={15} className="rtl:rotate-180" />
                </span>
              </Link>
            )}
          </div>

          {/* Two photo tiles: deals and setups */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:col-span-2 xl:col-span-1 xl:grid-cols-1">
            <PromoTile
              to="/shop?onSale=true"
              photo="/categories/laptops-v2-480.webp"
              kicker={t('home.dealsKicker')}
              title={off > 0 ? t('home.upTo', { percent: off }) : t('home.dealsTitle')}
              cta={t('home.seeAllDeals')}
            />
            <PromoTile
              to="/setups"
              photo="/categories/gaming-pcs-480.webp"
              kicker={t('common.setups')}
              title={t('home.promoSetupTitle')}
              cta={t('home.heroCtaShop')}
            />
          </div>
        </div>
      </Container>
    </section>
  )
}
