import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { productsApi } from '@/api/productsApi'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { ProductCard } from '@/components/product/ProductCard'
import { useT } from '@/hooks/useT'
import type { Product } from '@/types'

const MAX_SHOWN = 4

/**
 * "Similar products": other products of the same category, closest in price first (an alternative
 * a little cheaper or a little better). Also links product pages to each other for Google.
 */
export function SimilarProducts({ product, categorySlug }: { product: Product; categorySlug?: string }) {
  const t = useT()
  const similar = useQuery({
    queryKey: ['products', 'similar', categorySlug, product._id],
    queryFn: async () => (await productsApi.list({ category: categorySlug, limit: 12 })).data.data,
    enabled: Boolean(categorySlug),
    staleTime: 5 * 60_000,
  })

  const items = (similar.data ?? [])
    // Not the product itself, nor its own variants (other sizes / colours of the same model)
    .filter((p) => p._id !== product._id && !(product.variantGroup && p.variantGroup === product.variantGroup))
    .sort((a, b) => {
      // In stock first, then the closest price
      if ((a.stock > 0) !== (b.stock > 0)) return a.stock > 0 ? -1 : 1
      return Math.abs(a.price - product.price) - Math.abs(b.price - product.price)
    })
    .slice(0, MAX_SHOWN)

  if (!items.length) return null

  return (
    <section aria-labelledby="similar-heading" className="mt-10 sm:mt-14">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 sm:mb-5">
        <div>
          <p className="kicker">{t('productPage.similarKicker')}</p>
          <h2 id="similar-heading" className="mt-1.5 font-display text-xl font-semibold tracking-tight sm:text-2xl">
            {t('productPage.similarTitle')}
          </h2>
        </div>
        <Link
          to={`/category/${categorySlug}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--border)] px-4 text-sm font-medium transition hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
        >
          {t('common.viewAll')}
          <SiteIcon name="arrow-right" size={14} className="rtl:rotate-180" />
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {items.map((p) => (
          <ProductCard key={p._id} product={p} />
        ))}
      </div>
    </section>
  )
}
