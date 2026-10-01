import { useQuery } from '@tanstack/react-query'
import { settingsApi } from '@/api/settingsApi'
import { productsApi } from '@/api/productsApi'
import type { HeroPage, Product } from '@/types'

/** Page-header setting meaning "no product — show the page photo". */
export const HERO_NONE = 'none'

/**
 * Product chosen in Admin → Settings → Page header. When none is chosen, shows the
 * first featured product (or the newest one if nothing is featured). HERO_NONE or
 * no page disables it (the header then shows its default photo).
 */
export function useHeroProduct(page?: HeroPage): {
  product: Product | null
  pending: boolean
  /** True when the product was picked in admin, false when it is the automatic fallback. */
  pinned: boolean
  /** True when admin chose to show the page photo instead of any product. */
  hidden: boolean
} {
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await settingsApi.get()).data.data,
    staleTime: 60_000,
    enabled: Boolean(page),
  })
  const setting = (page && settings.data?.pageHeroProducts?.[page]) || ''
  const hidden = setting === HERO_NONE
  const id = hidden ? '' : setting

  const chosen = useQuery({
    queryKey: ['hero-product', id],
    queryFn: async () => (await productsApi.compare([id])).data.data[0] ?? null,
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
  })

  const needAuto =
    Boolean(page) &&
    settings.isSuccess &&
    !hidden &&
    (!id || (chosen.isSuccess && !chosen.data))
  const auto = useQuery({
    queryKey: ['hero-auto-products'],
    queryFn: async () => {
      const featured = (await productsApi.list({ featured: true, inStock: true, limit: 6 })).data.data
      if (featured.length) return featured
      return (await productsApi.list({ inStock: true, limit: 6 })).data.data
    },
    enabled: needAuto,
    staleTime: 5 * 60_000,
  })

  if (!page) return { product: null, pending: false, pinned: false, hidden: false }

  const pinnedProduct = (id && chosen.data) || null
  return {
    product: pinnedProduct || (needAuto ? (auto.data?.[0] ?? null) : null),
    pending:
      settings.isPending || (Boolean(id) && chosen.isPending) || (needAuto && auto.isPending),
    pinned: Boolean(pinnedProduct),
    hidden,
  }
}
