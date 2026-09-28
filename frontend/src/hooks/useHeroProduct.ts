import { useQuery } from '@tanstack/react-query'
import { settingsApi } from '@/api/settingsApi'
import { productsApi } from '@/api/productsApi'
import type { HeroPage, Product } from '@/types'

/** Product chosen in Admin → Settings → Page headers, or null for the default photo. */
export function useHeroProduct(page: HeroPage): { product: Product | null; pending: boolean } {
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await settingsApi.get()).data.data,
    staleTime: 60_000,
  })
  const id = settings.data?.pageHeroProducts?.[page] || ''

  const product = useQuery({
    queryKey: ['hero-product', id],
    queryFn: async () => (await productsApi.compare([id])).data.data[0] ?? null,
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
  })

  return {
    product: id ? (product.data ?? null) : null,
    pending: settings.isPending || (Boolean(id) && product.isPending),
  }
}
