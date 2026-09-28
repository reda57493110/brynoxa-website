import { useQuery } from '@tanstack/react-query'
import { settingsApi } from '@/api/settingsApi'
import { productsApi } from '@/api/productsApi'
import type { HeroPage, Product } from '@/types'

const AUTO_ORDER: Record<HeroPage, number> = { shop: 0, services: 1, contact: 2 }

/**
 * Product chosen in Admin → Settings → Page headers. When none is chosen, each page
 * shows a different featured product (or a newest product if nothing is featured).
 */
export function useHeroProduct(page: HeroPage): { product: Product | null; pending: boolean } {
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await settingsApi.get()).data.data,
    staleTime: 60_000,
  })
  const id = settings.data?.pageHeroProducts?.[page] || ''

  const chosen = useQuery({
    queryKey: ['hero-product', id],
    queryFn: async () => (await productsApi.compare([id])).data.data[0] ?? null,
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
  })

  const needAuto = settings.isSuccess && (!id || (chosen.isSuccess && !chosen.data))
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

  const autoList = auto.data ?? []
  const autoProduct = autoList.length ? autoList[AUTO_ORDER[page] % autoList.length] : null

  return {
    product: (id && chosen.data) || (needAuto ? autoProduct : null),
    pending:
      settings.isPending || (Boolean(id) && chosen.isPending) || (needAuto && auto.isPending),
  }
}
