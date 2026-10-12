import { useQuery } from '@tanstack/react-query'
import { settingsApi } from '@/api/settingsApi'
import { productsApi } from '@/api/productsApi'
import { HERO_NONE } from '@/hooks/useHeroProduct'
import type { Product } from '@/types'

export const MAX_HOME_DEALS = 4

const discount = (p: Product) => (p.compareAtPrice && p.compareAtPrice > p.price ? 1 - p.price / p.compareAtPrice : 0)

/**
 * Products shown at the top of the home page (max 4). Admin → Settings → Home page deals, in that
 * order; sold-out or hidden ones are skipped. With none chosen (or none left), the best in-stock
 * featured products, biggest discounts first. The older single "Home page" header product is
 * used when no deals were chosen yet; "no product" there hides the section.
 */
export function useHomeDeals(): { products: Product[]; pending: boolean; pinned: boolean } {
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await settingsApi.get()).data.data,
    staleTime: 60_000,
  })
  const legacy = settings.data?.pageHeroProducts?.home || ''
  const hidden = !settings.data?.homeDeals?.length && legacy === HERO_NONE
  const ids = settings.data?.homeDeals?.length ? settings.data.homeDeals : legacy && !hidden ? [legacy] : []
  const key = ids.join(',')

  const chosen = useQuery({
    queryKey: ['home-deals', key],
    queryFn: async () => {
      const found = (await productsApi.compare(ids)).data.data
      const byId = new Map(found.map((p) => [p._id, p]))
      return ids.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p && p.stock > 0))
    },
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
  })

  const needAuto = settings.isSuccess && !hidden && (!ids.length || (chosen.isSuccess && chosen.data.length === 0))
  const auto = useQuery({
    queryKey: ['home-deals-auto'],
    queryFn: async () => {
      let list = (await productsApi.list({ featured: true, inStock: true, limit: 12 })).data.data
      if (!list.length) list = (await productsApi.list({ inStock: true, limit: 12 })).data.data
      return [...list].sort((a, b) => discount(b) - discount(a)).slice(0, MAX_HOME_DEALS)
    },
    enabled: needAuto,
    staleTime: 5 * 60_000,
  })

  if (hidden) return { products: [], pending: false, pinned: false }
  const pinned = Boolean(chosen.data?.length)
  return {
    products: pinned ? chosen.data! : needAuto ? (auto.data ?? []) : [],
    pending: settings.isPending || (ids.length > 0 && chosen.isPending) || (needAuto && auto.isPending),
    pinned,
  }
}
