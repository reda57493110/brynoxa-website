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
import type { SiteIconName } from '@/components/ui/SiteIcon'
import type { MessageKey } from '@/i18n'

const BAND_ICON: Record<string, SiteIconName> = { small: 'tag', mid: 'laptop', high: 'star' }
const BAND_NAME: Record<string, MessageKey> = { small: 'home.budgetSmallName', mid: 'home.budgetMidName', high: 'home.budgetHighName' }

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
          </div>

          {/* Budget cards: tap one to see its products */}
          <div role="tablist" aria-label={t('home.budgetTitle')} className="-mx-4 mt-6 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
            {tabs.map((b) => {
              const on = b.id === active.id
              const from = Math.min(...b.items.map((p) => p.price))
              return (
                <button
                  key={b.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-controls="home-budget-panel"
                  onClick={() => setChosen(b.id)}
                  className={cn(
                    'group relative flex w-[15.5rem] shrink-0 snap-start items-center gap-3 overflow-hidden rounded-2xl border p-3.5 text-start transition sm:w-auto sm:flex-col sm:items-start sm:p-4',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
                    on
                      ? 'border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_12%,var(--bg))] shadow-glow'
                      : 'border-[var(--border)] bg-[var(--bg)] hover:-translate-y-0.5 hover:border-[var(--brand)]'
                  )}
                >
                  <span
                    className={cn(
                      'grid size-10 shrink-0 place-items-center rounded-xl transition',
                      on ? 'bg-[var(--brand)] text-[var(--brand-fg)]' : 'bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] text-[var(--brand-text)]'
                    )}
                  >
                    <SiteIcon name={BAND_ICON[b.id] ?? 'banknote'} size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">{t(BAND_NAME[b.id])}</span>
                    <span className="mt-0.5 block font-display text-lg font-semibold leading-tight sm:text-xl">
                      {t(b.label, { min: amount(b.min ?? 0), max: amount(b.max ?? 0) })}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--fg-muted)]">
                      {t('home.budgetCount', { count: b.items.length })} · {t('home.budgetFrom', { price: amount(from) })}
                    </span>
                  </span>
                  {on ? <SiteIcon name="check" size={16} className="absolute end-3 top-3 text-[var(--brand-text)]" /> : null}
                </button>
              )
            })}
          </div>

          {/* The chosen budget: up to 8 products */}
          <div id="home-budget-panel" role="tabpanel" className="mt-6">
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
              {active.items.slice(0, 8).map((p, i) => (
                <div key={p._id} className="h-full" data-rise="card" style={{ animationDelay: `${Math.min(i, 7) * 40}ms` }}>
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-col items-center gap-2 border-t border-[var(--border)] pt-5 sm:flex-row sm:justify-between">
              <p className="text-sm text-[var(--fg-muted)]">
                {t('home.budgetShowing', { shown: Math.min(8, active.items.length), count: active.items.length })}
              </p>
              <Link
                to={shopLink}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--brand)] px-5 text-sm font-semibold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110"
              >
                {t('home.budgetSeeAll')}
                <SiteIcon name="arrow-right" size={16} className="rtl:rotate-180" />
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
