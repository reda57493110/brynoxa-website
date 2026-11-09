import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { ProductCard } from '@/components/product/ProductCard'
import { useT } from '@/hooks/useT'
import { useLocaleStore } from '@/store/localeStore'
import { cn } from '@/lib/cn'
import type { Budget } from '@/lib/homeRows'
import type { Product } from '@/types'

/**
 * Last home section: "Shop by budget". Three price tabs (with how many products each), a grid of
 * up to 8 in-stock products for the chosen one, and a button to the shop filtered on that budget.
 * Tabs without products are not shown; the section hides when the shop has fewer than 4 products.
 */
export function HomeBudget({ budgets, total }: { budgets: (Budget & { items: Product[] })[]; total: number }) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  // 3,000 / 3 000 / ٣٬٠٠٠ in the visitor's language
  const amount = (n: number) => new Intl.NumberFormat(locale === 'ar' ? 'ar-MA' : locale === 'fr' ? 'fr-MA' : 'en-US').format(n)
  const tabs = budgets.filter((b) => b.items.length)
  const [chosen, setChosen] = useState<string | null>(null)
  if (total < 4 || !tabs.length) return null
  const active = tabs.find((b) => b.id === chosen) ?? tabs[0]
  const shopLink = `/shop?${new URLSearchParams({
    ...(active.min ? { minPrice: String(active.min) } : {}),
    ...(active.max ? { maxPrice: String(active.max) } : {}),
    sort: 'price_asc',
  }).toString()}`

  return (
    <section id="budget" aria-labelledby="home-budget-heading" className="pb-12 pt-6 sm:pb-16 sm:pt-8">
      <Container>
        <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-soft sm:rounded-[2rem] sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <p className="kicker inline-flex items-center gap-1.5">
                <SiteIcon name="banknote" size={13} />
                {t('home.budgetKicker')}
              </p>
              <h2 id="home-budget-heading" className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-4xl">
                {t('home.budgetTitle')}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)] sm:text-base">{t('home.budgetBody')}</p>
            </div>
            <Link
              to={shopLink}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 text-sm font-semibold text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
            >
              {t('home.budgetSeeAll')}
              <SiteIcon name="arrow-right" size={16} className="rtl:rotate-180" />
            </Link>
          </div>

          {/* Price tabs */}
          <div role="tablist" aria-label={t('home.budgetTitle')} className="-mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((b) => {
              const on = b.id === active.id
              return (
                <button
                  key={b.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-controls="home-budget-panel"
                  onClick={() => setChosen(b.id)}
                  className={cn(
                    'inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
                    on
                      ? 'border-transparent bg-[var(--brand)] text-[var(--brand-fg)] shadow-glow'
                      : 'border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] hover:border-[var(--brand)]'
                  )}
                >
                  {t(b.label, { min: amount(b.min ?? 0), max: amount(b.max ?? 0) })}
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-[11px] tabular-nums',
                      on ? 'bg-white/25' : 'bg-[var(--bg-muted)] text-[var(--fg-muted)]'
                    )}
                  >
                    {b.items.length}
                  </span>
                </button>
              )
            })}
          </div>

          {/* The chosen budget: up to 8 products */}
          <div
            id="home-budget-panel"
            role="tabpanel"
            className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4"
          >
            {active.items.slice(0, 8).map((p, i) => (
              <div key={p._id} className="h-full" data-rise="card" style={{ animationDelay: `${Math.min(i, 7) * 40}ms` }}>
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  )
}
