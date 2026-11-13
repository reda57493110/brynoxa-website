import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Container } from '@/components/ui/Container'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { ProductCard } from '@/components/product/ProductCard'
import { ProductCarousel } from '@/components/product/ProductCarousel'
import { productsApi } from '@/api/productsApi'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useT } from '@/hooks/useT'
import { useLocaleStore } from '@/store/localeStore'
import { cn } from '@/lib/cn'
import { ownBudgetAmount, type Budget } from '@/lib/homeRows'
import type { Product } from '@/types'
import type { SiteIconName } from '@/components/ui/SiteIcon'
import type { MessageKey } from '@/i18n'

const BAND_ICON: Record<string, SiteIconName> = { small: 'tag', mid: 'laptop', high: 'star' }
const BAND_NAME: Record<string, MessageKey> = { small: 'home.budgetSmallName', mid: 'home.budgetMidName', high: 'home.budgetHighName' }
/** Products shown for a budget */
/** Two full rows of three on computers */
const SHOWN = 6

/**
 * Last home section: "Shop by budget". Three price tiles (with how many products each) or the
 * customer's own budget ("up to X DH": the best in-stock products under it, dearest first), the
 * products for it (sliding by themselves on phones, a grid on bigger screens) and a button to the
 * shop filtered on that budget. Tiles without products are not shown; the section hides when the
 * shop has fewer than 4 products.
 */
export function HomeBudget({ budgets, total }: { budgets: (Budget & { items: Product[] })[]; total: number }) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const isPhone = !useMediaQuery('(min-width: 640px)')
  // 3,000 / 3 000 / ٣٬٠٠٠ in the visitor's language
  const amount = (n: number) => new Intl.NumberFormat(locale === 'ar' ? 'ar-MA' : locale === 'fr' ? 'fr-MA' : 'en-US').format(n)
  const tabs = budgets.filter((b) => b.items.length)
  const [chosen, setChosen] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [own, setOwn] = useState<number | null>(null)

  const ownQuery = useQuery({
    queryKey: ['products', 'home-budget-own', own],
    queryFn: async () => {
      const res = (await productsApi.list({ maxPrice: own ?? undefined, inStock: true, sort: 'price_desc', limit: SHOWN })).data
      return { items: res.data, count: res.meta?.total ?? res.data.length }
    },
    enabled: own !== null,
    staleTime: 60_000,
  })

  if (total < 4 || !tabs.length) return null
  const active = tabs.find((b) => b.id === chosen) ?? tabs[0]
  const items = own !== null ? (ownQuery.data?.items ?? []) : active.items.slice(0, SHOWN)
  const count = own !== null ? (ownQuery.data?.count ?? 0) : active.items.length
  const range = own !== null ? { max: own } : { min: active.min, max: active.max }
  const shopLink = `/shop?${new URLSearchParams({
    ...(range.min ? { minPrice: String(range.min) } : {}),
    ...(range.max ? { maxPrice: String(range.max) } : {}),
    sort: own !== null ? 'price_desc' : 'price_asc',
  }).toString()}`

  const submitOwn = (e: FormEvent) => {
    e.preventDefault()
    const value = ownBudgetAmount(draft)
    if (value !== null) setOwn(value)
  }
  const clearOwn = () => {
    setOwn(null)
    setDraft('')
  }

  return (
    <section id="budget" aria-labelledby="home-budget-heading" className="pb-10 pt-4 sm:pb-16 sm:pt-8">
      <Container>
        <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-soft sm:rounded-[2rem] sm:p-7">
          <div className="max-w-xl">
            <h2 id="home-budget-heading" className="font-display text-lg font-semibold leading-tight tracking-tight sm:mt-2 sm:text-4xl">
              {t('home.budgetTitle')}
            </h2>
            <p className="mt-2 hidden text-base leading-relaxed text-[var(--fg-muted)] sm:block">{t('home.budgetBody')}</p>
          </div>

          {/* Computers: the budget choices in a column on the left, the products on the right */}
          <div className="lg:mt-6 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start lg:gap-6">
          <div className="lg:sticky lg:top-24">
          {/* Budget tiles: tap one to see its products */}
          <div role="tablist" aria-label={t('home.budgetTitle')} className="mt-3 grid grid-cols-3 gap-1.5 sm:mt-6 sm:gap-3 lg:mt-0 lg:grid-cols-1 lg:gap-2">
            {tabs.map((b) => {
              const on = own === null && b.id === active.id
              const from = Math.min(...b.items.map((p) => p.price))
              return (
                <button
                  key={b.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-controls="home-budget-panel"
                  onClick={() => {
                    setChosen(b.id)
                    clearOwn()
                  }}
                  className={cn(
                    'group relative flex min-w-0 flex-col items-start gap-2 overflow-hidden rounded-xl border p-2.5 text-start transition sm:gap-3 sm:rounded-2xl sm:p-4 lg:flex-row lg:items-center lg:p-3',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
                    on
                      ? 'border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_12%,var(--bg))] shadow-glow'
                      : 'border-[var(--border)] bg-[var(--bg)] hover:-translate-y-0.5 hover:border-[var(--brand)]'
                  )}
                >
                  <span
                    className={cn(
                      'grid size-8 shrink-0 place-items-center rounded-lg transition sm:size-10 sm:rounded-xl',
                      on ? 'bg-[var(--brand)] text-[var(--brand-fg)]' : 'bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] text-[var(--brand-text)]'
                    )}
                  >
                    <SiteIcon name={BAND_ICON[b.id] ?? 'banknote'} size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="hidden text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-muted)] sm:block">{t(BAND_NAME[b.id])}</span>
                    <span className="block font-display text-[11px] font-semibold leading-tight sm:mt-0.5 sm:text-xl lg:text-base">
                      {t(b.label, { min: amount(b.min ?? 0), max: amount(b.max ?? 0) })}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-[var(--fg-muted)] sm:mt-1 sm:text-xs">
                      {t('home.budgetCount', { count: b.items.length })}
                      <span className="hidden sm:inline"> · {t('home.budgetFrom', { price: amount(from) })}</span>
                    </span>
                  </span>
                  {on ? <SiteIcon name="check" size={16} className="absolute end-2 top-2 text-[var(--brand-text)] sm:end-3 sm:top-3" /> : null}
                </button>
              )
            })}
          </div>

          {/* The customer's own budget */}
          <form
            onSubmit={submitOwn}
            className={cn(
              'mt-2 flex flex-col gap-2 rounded-xl border p-2.5 transition sm:mt-3 sm:flex-row sm:items-center sm:gap-4 sm:rounded-2xl sm:p-4 lg:mt-2 lg:flex-col lg:items-stretch lg:gap-2.5 lg:p-3',
              own !== null
                ? 'border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_12%,var(--bg))] shadow-glow'
                : 'border-dashed border-[var(--border)] bg-[var(--bg)]'
            )}
          >
            <label htmlFor="home-budget-own" className="flex items-center gap-2 text-[13px] font-semibold sm:shrink-0 sm:gap-2.5 sm:text-sm">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] text-[var(--brand-text)] sm:size-10 sm:rounded-xl">
                <SiteIcon name="sliders" size={18} />
              </span>
              {t('home.budgetOwnTitle')}
            </label>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <input
                  id="home-budget-own"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={9}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.replace(/[^\d\s.,]/g, ''))}
                  placeholder={t('home.budgetOwnPlaceholder')}
                  className="h-10 w-full rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] pe-12 ps-4 text-sm font-semibold sm:h-11 outline-none transition focus:border-[var(--brand)]"
                />
                <span className="pointer-events-none absolute end-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--fg-muted)]">DH</span>
              </div>
              <button
                type="submit"
                disabled={ownBudgetAmount(draft) === null}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-[var(--brand)] px-3.5 text-sm font-semibold sm:h-11 sm:px-4 text-[var(--brand-fg)] transition hover:brightness-110 disabled:opacity-50"
              >
                <SiteIcon name="search" size={15} />
                {t('home.budgetOwnShow')}
              </button>
              {own !== null ? (
                <button
                  type="button"
                  onClick={clearOwn}
                  aria-label={t('home.budgetOwnClear')}
                  title={t('home.budgetOwnClear')}
                  className="grid size-10 shrink-0 place-items-center rounded-full border sm:size-11 border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg-muted)] transition hover:text-[var(--fg)]"
                >
                  <SiteIcon name="close" size={16} />
                </button>
              ) : null}
            </div>
          </form>
          </div>

          {/* The chosen budget: up to 6 products */}
          <div id="home-budget-panel" role="tabpanel" className="mt-4 sm:mt-6 lg:mt-0">
            {own !== null ? (
              <p className="mb-2 text-[13px] font-semibold sm:mb-3 sm:text-sm">{t('home.budgetOwnLabel', { max: amount(own) })}</p>
            ) : null}
            {own !== null && ownQuery.isPending ? (
              <div className="grid h-40 place-items-center text-sm text-[var(--fg-muted)]">…</div>
            ) : !items.length ? (
              <p className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--fg-muted)]">
                {t('home.budgetOwnEmpty', { max: amount(own ?? 0) })}
              </p>
            ) : isPhone ? (
              <ProductCarousel key={own ?? active.id} products={items} />
            ) : (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                {items.map((p, i) => (
                  <div key={p._id} className="h-full" data-rise="card" style={{ animationDelay: `${Math.min(i, 7) * 40}ms` }}>
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>
            )}
            {items.length ? (
              <div className="mt-3 flex flex-col items-center gap-2 border-t border-[var(--border)] pt-3 sm:mt-5 sm:flex-row sm:justify-between sm:pt-5">
                <p className="text-[12px] text-[var(--fg-muted)] sm:text-sm">{t('home.budgetShowing', { shown: items.length, count })}</p>
                <Link
                  to={shopLink}
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--brand)] px-5 text-sm font-semibold text-[var(--brand-fg)] shadow-glow sm:h-11 transition hover:brightness-110"
                >
                  {t('home.budgetSeeAll')}
                  <SiteIcon name="arrow-right" size={16} className="rtl:rotate-180" />
                </Link>
              </div>
            ) : null}
          </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
