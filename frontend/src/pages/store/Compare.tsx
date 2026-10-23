import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { productsApi } from '@/api/productsApi'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { SafeImage } from '@/components/ui/SafeImage'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { ConditionBadge } from '@/components/product/ConditionBadge'
import { useAddToCart } from '@/components/home/HomeSpotlight'
import { isPreOwned } from '@/lib/condition'
import { useCompareStore } from '@/store/compareStore'
import { COMPARE_MAX } from '@/lib/constants'
import { useT } from '@/hooks/useT'
import { usePageTitle } from '@/hooks/usePageTitle'
import { PageHero } from '@/components/layout/PageHero'
import { useLocaleStore } from '@/store/localeStore'
import { formatCurrency } from '@/lib/format'
import { imageFit, sizedImageUrl } from '@/lib/image'
import { cn } from '@/lib/cn'
import { bestIndexes, isLowerBetter, overallPick, rankValue } from '@/lib/compareBest'
import {
  SPEC_FIELDS,
  formatSpecValue,
  getTemplate,
  normalizeSpecs,
  resolveTemplate,
  specLabel,
  templateFields,
} from '@/lib/specs'
import type { Category, Product } from '@/types'

/** One line of the comparison: a label, what each product shows, and who wins it. */
interface Row {
  key: string
  label: string
  cells: ReactNode[]
  /** Raw values, to hide rows where every product is the same. */
  raw: string[]
  best: number[]
  /** Short name for the "best at" badges ("Lowest price", "RAM"). */
  badge?: string
}

const primaryImage = (p: Product) => p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url

function AddToCartButton({ product }: { product: Product }) {
  const t = useT()
  const add = useAddToCart(product)
  return (
    <Button size="sm" className="h-9 w-full rounded-full" onClick={add} disabled={product.stock <= 0}>
      <SiteIcon name="cart" size={14} />
      {product.stock > 0 ? t('common.addToCart') : t('product.outOfStock')}
    </Button>
  )
}

export function Compare() {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  usePageTitle(t('compare.title'), { noIndex: true })
  const navigate = useNavigate()
  const items = useCompareStore((s) => s.items)
  const remove = useCompareStore((s) => s.remove)
  const clear = useCompareStore((s) => s.clear)
  const [onlyDifferences, setOnlyDifferences] = useState(false)

  const ids = items.map((i) => i._id)
  const remote = useQuery({
    queryKey: ['compare', ids],
    queryFn: async () => (await productsApi.compare(ids)).data.data,
    enabled: ids.length > 0,
  })

  const list = remote.data?.length ? remote.data : items

  if (remote.isError) {
    return (
      <Container className="py-8 sm:py-10">
        <QueryErrorState title={t('shop.loadError')} description={t('shop.loadErrorBody')} onRetry={() => remote.refetch()} />
      </Container>
    )
  }

  if (!list.length) {
    return (
      <>
        <PageHero kicker={t('compare.kicker')} title={t('compare.heading')} />
        <Container className="py-5 sm:py-10">
          <EmptyState
            icon="layers"
            title={t('compare.emptyTitle')}
            description={t('compare.emptyBody', { max: COMPARE_MAX })}
            actionLabel={t('common.shopNow')}
            onAction={() => navigate('/shop')}
          />
        </Container>
      </>
    )
  }

  // ---------- rows ----------
  const templateOf = (p: Product) =>
    resolveTemplate(p.specTemplate, typeof p.category === 'object' ? (p.category as Category) : null)
  const specsById = new Map(list.map((p) => [p._id, normalizeSpecs(p.specs, templateOf(p))]))
  const order = templateFields(getTemplate(templateOf(list[0])))
  const rank = (k: string) => (order.includes(k) ? order.indexOf(k) : order.length)
  const specKeys = Array.from(new Set(list.flatMap((p) => Object.keys(specsById.get(p._id) ?? {})))).sort(
    (a, b) => rank(a) - rank(b)
  )
  const saving = (p: Product) => (p.compareAtPrice && p.compareAtPrice > p.price ? p.compareAtPrice - p.price : 0)

  const rows: Row[] = [
    {
      key: 'price',
      label: t('ui.price'),
      raw: list.map((p) => String(p.price)),
      // A product that cannot be bought does not win on price
      best: bestIndexes(list.map((p) => (p.stock > 0 ? p.price : null)), true),
      badge: t('compare.badgeCheapest'),
      cells: list.map((p) => (
        <span key={p._id} className="font-display text-base font-bold sm:text-lg">
          {formatCurrency(p.price)}
        </span>
      )),
    },
    {
      key: 'saving',
      label: t('compare.rowSaving'),
      raw: list.map((p) => String(saving(p))),
      best: bestIndexes(list.map((p) => (p.stock > 0 ? saving(p) || null : null)), false),
      badge: t('compare.badgeSaving'),
      cells: list.map((p) =>
        saving(p) ? (
          <span key={p._id}>
            {formatCurrency(saving(p))}{' '}
            <span className="text-[var(--fg-muted)] line-through">{formatCurrency(p.compareAtPrice!)}</span>
          </span>
        ) : (
          '—'
        )
      ),
    },
    {
      key: 'stock',
      label: t('ui.stock'),
      raw: list.map((p) => (p.stock > 0 ? 'in' : 'out')),
      best: [],
      cells: list.map((p) =>
        p.stock <= 0 ? (
          <span key={p._id} className="text-[var(--danger)]">{t('product.outOfStock')}</span>
        ) : p.stock <= (p.lowStockThreshold ?? 5) ? (
          <span key={p._id} className="font-medium text-[#c98a00] dark:text-[#ffc53d]">{t('stock.onlyLeft', { count: p.stock })}</span>
        ) : (
          <span key={p._id} className="font-medium text-[#1f9d5c] dark:text-[#3dd68c]">{t('stock.inStock')}</span>
        )
      ),
    },
    {
      key: 'condition',
      label: t('condition.noteTitle'),
      raw: list.map((p) => p.condition ?? 'new'),
      best: [],
      cells: list.map((p) => (
        <span key={p._id}>
          <span className={isPreOwned(p.condition) ? 'font-semibold' : undefined}>{t(`condition.${p.condition ?? 'new'}`)}</span>
          {isPreOwned(p.condition) && p.conditionNote?.trim() ? (
            <span className="mt-1 block whitespace-pre-line text-xs text-[var(--fg-muted)]">{p.conditionNote.trim()}</span>
          ) : null}
        </span>
      )),
    },
    ...specKeys.map((key): Row => {
      const values = list.map((p) => specsById.get(p._id)?.[key])
      const numberField = SPEC_FIELDS[key]?.type === 'number'
      const label = specLabel(key, locale)
      return {
        key,
        label,
        raw: values.map((v) => v ?? ''),
        best: bestIndexes(values.map((v) => rankValue(key, v, numberField)), isLowerBetter(key)),
        badge: label,
        cells: values.map((v) => (v ? formatSpecValue(key, v, locale) : '—')),
      }
    }),
  ]

  // Who wins what
  const wins = list.map((_, i) => rows.filter((r) => r.best.includes(i)))
  const pick = overallPick(wins.map((w) => w.length))
  const comparable = rows.filter((r) => r.best.length).length
  const shownRows = onlyDifferences ? rows.filter((r) => new Set(r.raw).size > 1) : rows
  const freeSlots = Math.max(0, COMPARE_MAX - list.length)

  const stickyCol = 'sticky start-0 z-10 bg-[var(--bg-elevated)]'

  return (
    <>
      <PageHero
        kicker={t('compare.kicker')}
        title={t('compare.heading')}
        description={t('compare.count', { count: list.length, max: COMPARE_MAX })}
      >
        <Button variant="outline" size="sm" onClick={clear}>
          {t('ui.clearAll')}
        </Button>
      </PageHero>

      <Container className="space-y-4 py-5 sm:space-y-5 sm:py-8">
        {/* Verdict */}
        {pick != null ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--brand)_35%,transparent)] bg-[color-mix(in_srgb,var(--brand)_8%,var(--bg-elevated))] p-3.5 sm:p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--brand)] text-[var(--brand-fg)]">
              <SiteIcon name="star" size={18} solid />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-semibold sm:text-base">
                {t('compare.verdict', { name: list[pick].name })}
              </p>
              <p className="text-xs text-[var(--fg-muted)] sm:text-sm">
                {t('compare.verdictBody', { wins: wins[pick].length, total: comparable })}
              </p>
            </div>
            <Link
              to={`/product/${list[pick].slug}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-[var(--brand-fg)] shadow-glow"
            >
              {t('product.viewProduct')}
              <SiteIcon name="arrow-right" size={14} className="rtl:rotate-180" />
            </Link>
          </div>
        ) : list.length === 1 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-[var(--border)] p-3.5 text-sm text-[var(--fg-muted)] sm:p-4">
            <SiteIcon name="plus" size={18} className="shrink-0 text-[var(--brand-text)]" />
            {t('compare.addOneMore')}
          </div>
        ) : null}

        {/* Toolbar */}
        {list.length > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setOnlyDifferences((v) => !v)}
              aria-pressed={onlyDifferences}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition',
                onlyDifferences
                  ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-fg)]'
                  : 'border-[var(--border)] bg-[var(--bg-elevated)] hover:border-[var(--brand)]'
              )}
            >
              <span
                className={cn(
                  'relative h-4 w-7 rounded-full transition',
                  onlyDifferences ? 'bg-white/40' : 'bg-[var(--bg-muted)]'
                )}
                aria-hidden="true"
              >
                <span className={cn('absolute top-0.5 size-3 rounded-full bg-white shadow transition-all', onlyDifferences ? 'start-3.5' : 'start-0.5')} />
              </span>
              {t('compare.onlyDifferences')}
            </button>
            <p className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)]">
              <span className="inline-block size-3 rounded bg-[color-mix(in_srgb,var(--brand)_22%,transparent)] ring-1 ring-[var(--brand)]" />
              {t('compare.legend')}
            </p>
          </div>
        ) : null}

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-soft">
          {/* Equal product columns; on small screens the table scrolls sideways with the labels pinned */}
          <table
            className="w-full table-fixed border-separate border-spacing-0 text-sm"
            style={{ minWidth: `${7 + list.length * 11 + (freeSlots ? 9 : 0)}rem` }}
          >
            <thead>
              <tr>
                <th className={cn(stickyCol, 'w-28 min-w-28 border-b border-[var(--border)] p-3 text-start align-bottom text-xs font-medium text-[var(--fg-muted)] sm:w-44 sm:min-w-44 sm:p-4')}>
                  {t('ui.product')}
                </th>
                {list.map((p, i) => {
                  const img = primaryImage(p)
                  return (
                    <th
                      key={p._id}
                      className={cn(
                        'border-b border-[var(--border)] p-3 text-start align-top font-normal sm:p-4',
                        i === pick && 'bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]'
                      )}
                    >
                      <div className="relative flex h-full flex-col gap-2.5">
                        <button
                          type="button"
                          className="absolute end-0 top-0 z-10 grid size-7 place-items-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg-muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)]"
                          onClick={() => remove(p._id)}
                          aria-label={t('ui.remove')}
                        >
                          <SiteIcon name="close" size={13} />
                        </button>
                        <Link
                          to={`/product/${p.slug}`}
                          className={cn(
                            'relative block aspect-[4/3] overflow-hidden rounded-xl',
                            imageFit(img) === 'contain' ? 'photo-stage' : 'bg-[var(--bg-muted)]'
                          )}
                        >
                          {img ? (
                            <SafeImage
                              src={sizedImageUrl(img, 480)}
                              alt=""
                              width={480}
                              height={360}
                              referrerPolicy="no-referrer"
                              className={cn(
                                'h-full w-full',
                                imageFit(img) === 'contain' ? 'object-contain p-2 mix-blend-multiply' : 'object-cover'
                              )}
                            />
                          ) : null}
                          {i === pick ? (
                            <span className="absolute start-2 top-2 inline-flex items-center gap-1 rounded-full bg-[var(--brand)] px-2 py-0.5 text-[11px] font-bold text-[var(--brand-fg)] shadow-glow">
                              <SiteIcon name="star" size={11} solid />
                              {t('compare.ourPick')}
                            </span>
                          ) : null}
                        </Link>
                        <div className="min-w-0">
                          <Link to={`/product/${p.slug}`} className="line-clamp-2 font-display text-sm font-semibold leading-snug hover:text-[var(--brand-text)] sm:text-base">
                            {p.name}
                          </Link>
                          <ConditionBadge condition={p.condition} size="sm" className="mt-1" />
                        </div>
                        {/* What this product is best at */}
                        {wins[i].length ? (
                          <div className="flex flex-wrap gap-1">
                            {wins[i].slice(0, 3).map((r) => (
                              <span
                                key={r.key}
                                className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--brand-text)]"
                              >
                                <SiteIcon name="check" size={10} />
                                {r.key === 'price' || r.key === 'saving' ? r.badge : t('compare.bestAt', { label: r.badge ?? r.label })}
                              </span>
                            ))}
                            {wins[i].length > 3 ? (
                              <span className="px-1 text-[11px] text-[var(--fg-muted)]">+{wins[i].length - 3}</span>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="mt-auto">
                          <AddToCartButton product={p} />
                        </div>
                      </div>
                    </th>
                  )
                })}
                {freeSlots ? (
                  <th className="w-36 border-b border-[var(--border)] p-3 align-top sm:w-44 sm:p-4">
                    <Link
                      to="/shop"
                      className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--border)] text-center text-xs font-medium text-[var(--fg-muted)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] sm:text-sm"
                    >
                      <span className="grid size-9 place-items-center rounded-full bg-[var(--bg-muted)]">
                        <SiteIcon name="plus" size={16} />
                      </span>
                      {t('compare.addProduct')}
                      <span className="text-[11px] font-normal">{t('compare.slotsLeft', { count: freeSlots })}</span>
                    </Link>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {shownRows.map((row) => (
                <tr key={row.key} className="group">
                  <td className={cn(stickyCol, 'border-b border-[var(--border)] p-3 text-xs font-medium text-[var(--fg-muted)] group-last:border-b-0 sm:p-4 sm:text-sm')}>
                    {row.label}
                  </td>
                  {row.cells.map((cell, i) => {
                    const isBest = row.best.includes(i)
                    return (
                      <td
                        key={list[i]._id}
                        className={cn(
                          'border-b border-[var(--border)] p-3 align-top group-last:border-b-0 sm:p-4',
                          isBest
                            ? 'bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] font-semibold text-[var(--fg)]'
                            : i === pick
                              ? 'bg-[color-mix(in_srgb,var(--brand)_4%,transparent)]'
                              : undefined
                        )}
                      >
                        <span className="flex items-start gap-1.5">
                          {isBest ? <SiteIcon name="check" size={14} className="mt-0.5 shrink-0 text-[var(--brand-text)]" /> : null}
                          <span className="min-w-0">{cell}</span>
                        </span>
                      </td>
                    )
                  })}
                  {freeSlots ? <td className="border-b border-[var(--border)] group-last:border-b-0" /> : null}
                </tr>
              ))}
              {onlyDifferences && !shownRows.length ? (
                <tr>
                  <td colSpan={list.length + 1 + (freeSlots ? 1 : 0)} className="p-6 text-center text-sm text-[var(--fg-muted)]">
                    {t('compare.noDifferences')}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Container>
    </>
  )
}
