import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { productsApi } from '@/api/productsApi'
import { ProductCard } from '@/components/product/ProductCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useT } from '@/hooks/useT'
import { useLocaleStore } from '@/store/localeStore'

const cardWidth = 'w-[46vw] max-w-[15rem] shrink-0 snap-start sm:w-[13.5rem] lg:w-[14.5rem]'
const arrowBtn =
  'hidden h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] sm:inline-flex'

/** Complementary products for the product being viewed (hidden when there are none). */
export function CompleteSetup({ productId }: { productId: string }) {
  const t = useT()
  const rtl = useLocaleStore((s) => s.locale) === 'ar'
  const rowRef = useRef<HTMLDivElement>(null)

  const recommendations = useQuery({
    queryKey: ['products', 'recommendations', productId],
    queryFn: async () => (await productsApi.recommendations(productId)).data.data,
    staleTime: 5 * 60_000,
  })

  if (recommendations.isError || (recommendations.data && !recommendations.data.length)) return null

  const scroll = (direction: 1 | -1) => {
    const row = rowRef.current
    if (!row) return
    row.scrollBy({ left: direction * (rtl ? -1 : 1) * row.clientWidth * 0.85, behavior: 'smooth' })
  }

  return (
    <section aria-labelledby="complete-setup-heading" className="mt-8 border-t border-[var(--border)] pt-6 sm:mt-10 sm:pt-8">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="complete-setup-heading"
          className="font-display text-lg font-semibold tracking-tight text-[var(--fg)] sm:text-2xl"
        >
          {t('productPage.completeSetup')}
        </h2>
        <div className="flex gap-2">
          <button type="button" className={arrowBtn} onClick={() => scroll(-1)} aria-label={t('productPage.scrollBack')}>
            <SiteIcon name="chevron-left" size={18} className="rtl:rotate-180" />
          </button>
          <button type="button" className={arrowBtn} onClick={() => scroll(1)} aria-label={t('productPage.scrollForward')}>
            <SiteIcon name="chevron-right" size={18} className="rtl:rotate-180" />
          </button>
        </div>
      </div>

      <div
        ref={rowRef}
        className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:scroll-px-0 sm:px-0 sm:gap-4 [&::-webkit-scrollbar]:hidden"
      >
        {recommendations.data
          ? recommendations.data.map((product) => (
              <div key={product._id} className={cardWidth}>
                <ProductCard product={product} />
              </div>
            ))
          : Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className={`${cardWidth} aspect-[3/4] rounded-[var(--radius-card)] ring-0`} />
            ))}
      </div>
    </section>
  )
}
