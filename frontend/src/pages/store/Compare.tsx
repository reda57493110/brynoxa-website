import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { productsApi } from '@/api/productsApi'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { Price } from '@/components/product/Price'
import { ConditionBadge } from '@/components/product/ConditionBadge'
import { isPreOwned } from '@/lib/condition'
import { useCompareStore } from '@/store/compareStore'
import { COMPARE_MAX } from '@/lib/constants'
import { useT } from '@/hooks/useT'
import { usePageTitle } from '@/hooks/usePageTitle'
import { PageHero } from '@/components/layout/PageHero'
import { useLocaleStore } from '@/store/localeStore'
import { formatSpecValue, getTemplate, normalizeSpecs, resolveTemplate, specLabel, templateFields } from '@/lib/specs'
import type { Category } from '@/types'

export function Compare() {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  usePageTitle(t('compare.title'), { noIndex: true })
  const navigate = useNavigate()
  const items = useCompareStore((s) => s.items)
  const remove = useCompareStore((s) => s.remove)
  const clear = useCompareStore((s) => s.clear)

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
        <QueryErrorState
          title={t('shop.loadError')}
          description={t('shop.loadErrorBody')}
          onRetry={() => remote.refetch()}
        />
      </Container>
    )
  }

  if (!list.length) {
    return (
      <>
        <PageHero kicker={t('compare.kicker')} title={t('compare.heading')} />
      <Container className="py-5 sm:py-10">
        <EmptyState
          icon="refresh"
          title={t('compare.emptyTitle')}
          description={t('compare.emptyBody', { max: COMPARE_MAX })}
          actionLabel={t('common.shopNow')}
          onAction={() => navigate('/shop')}
        />
      </Container>
      </>
    )
  }

  // Each product's specs mapped onto its spec type; rows in the first product's order
  const templateOf = (p: (typeof list)[number]) =>
    resolveTemplate(p.specTemplate, typeof p.category === 'object' ? (p.category as Category) : null)
  const specsById = new Map(list.map((p) => [p._id, normalizeSpecs(p.specs, templateOf(p))]))
  const order = list[0] ? templateFields(getTemplate(templateOf(list[0]))) : []
  const rank = (k: string) => (order.includes(k) ? order.indexOf(k) : order.length)
  const allSpecKeys = Array.from(new Set(list.flatMap((p) => Object.keys(specsById.get(p._id) ?? {})))).sort(
    (a, b) => rank(a) - rank(b)
  )

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
    <Container className="py-5 sm:py-10">

      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="p-4 text-start text-[var(--fg-muted)]">{t('ui.product')}</th>
              {list.map((p) => (
                <th key={p._id} className="min-w-[180px] p-4 text-start align-top">
                  <div className="relative">
                    <button
                      type="button"
                      className="absolute end-0 top-0 rounded-lg p-1 hover:bg-[var(--bg-muted)]"
                      onClick={() => remove(p._id)}
                      aria-label={t('ui.remove')}
                    >
                      <SiteIcon name="close" size={16} />
                    </button>
                    <Link to={`/product/${p.slug}`} className="block pe-6 font-display font-semibold hover:text-[var(--brand)]">
                      {p.name}
                    </Link>
                    <ConditionBadge condition={p.condition} size="sm" className="mt-1.5" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[var(--border)]">
              <td className="p-4 text-[var(--fg-muted)]">{t('ui.price')}</td>
              {list.map((p) => (
                <td key={p._id} className="p-4">
                  <Price price={p.price} compareAt={p.compareAtPrice} />
                </td>
              ))}
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="p-4 text-[var(--fg-muted)]">{t('condition.noteTitle')}</td>
              {list.map((p) => (
                <td key={p._id} className="p-4">
                  <span className={isPreOwned(p.condition) ? 'font-semibold' : undefined}>
                    {t(`condition.${p.condition ?? 'new'}`)}
                  </span>
                  {isPreOwned(p.condition) && p.conditionNote?.trim() ? (
                    <p className="mt-1 whitespace-pre-line text-xs text-[var(--fg-muted)]">
                      {p.conditionNote.trim()}
                    </p>
                  ) : null}
                </td>
              ))}
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="p-4 text-[var(--fg-muted)]">{t('ui.stock')}</td>
              {list.map((p) => (
                <td key={p._id} className="p-4">
                  {p.stock}
                </td>
              ))}
            </tr>
            {allSpecKeys.map((key) => (
              <tr key={key} className="border-b border-[var(--border)]">
                <td className="p-4 text-[var(--fg-muted)]">{specLabel(key, locale)}</td>
                {list.map((p) => (
                  <td key={p._id} className="p-4">
                    {specsById.get(p._id)?.[key] ? formatSpecValue(key, specsById.get(p._id)![key], locale) : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Container>
    </>
  )
}
