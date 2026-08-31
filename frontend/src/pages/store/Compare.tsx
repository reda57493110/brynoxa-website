import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { productsApi } from '@/api/productsApi'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { Price } from '@/components/product/Price'
import { RatingStars } from '@/components/product/RatingStars'
import { useCompareStore } from '@/store/compareStore'
import { COMPARE_MAX } from '@/lib/constants'
import { useT } from '@/hooks/useT'

export function Compare() {
  const t = useT()
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
      <Container className="py-8 sm:py-10">
        <EmptyState
          icon="refresh"
          title={t('compare.emptyTitle')}
          description={t('compare.emptyBody', { max: COMPARE_MAX })}
          actionLabel={t('common.shopNow')}
          onAction={() => navigate('/shop')}
        />
      </Container>
    )
  }

  const allSpecKeys = Array.from(
    new Set(list.flatMap((p) => Object.keys((p.specs as Record<string, string>) || {})))
  )

  return (
    <Container className="py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">{t('compare.heading')}</h1>
          <p className="text-sm text-[var(--fg-muted)]">
            {t('compare.count', { count: list.length, max: COMPARE_MAX })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={clear}>
          {t('ui.clearAll')}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="p-4 text-left text-[var(--fg-muted)]">{t('ui.product')}</th>
              {list.map((p) => (
                <th key={p._id} className="min-w-[180px] p-4 text-left align-top">
                  <div className="relative">
                    <button
                      type="button"
                      className="absolute right-0 top-0 rounded-lg p-1 hover:bg-[var(--bg-muted)]"
                      onClick={() => remove(p._id)}
                      aria-label={t('ui.remove')}
                    >
                      <SiteIcon name="close" size={16} />
                    </button>
                    <Link to={`/product/${p.slug}`} className="block pr-6 font-display font-semibold hover:text-[var(--brand)]">
                      {p.name}
                    </Link>
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
              <td className="p-4 text-[var(--fg-muted)]">{t('ui.rating')}</td>
              {list.map((p) => (
                <td key={p._id} className="p-4">
                  <RatingStars rating={p.averageRating} count={p.reviewCount} />
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
                <td className="p-4 text-[var(--fg-muted)]">{key}</td>
                {list.map((p) => (
                  <td key={p._id} className="p-4">
                    {((p.specs as Record<string, string>) || {})[key] || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Container>
  )
}
