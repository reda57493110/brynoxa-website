import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { productsApi } from '@/api/productsApi'
import { useCartStore } from '@/store/cartStore'
import { toast } from '@/store/toastStore'
import { useT } from '@/hooks/useT'

/**
 * Today's data for the products in the cart (price, stock, deposit rules). Prices saved in the
 * cart can be days old: they are brought up to date here, with a short notice, so the cart and
 * checkout always show what the courier will actually collect. Shared by Cart and Checkout.
 */
export function useCartLiveProducts() {
  const t = useT()
  const items = useCartStore((s) => s.items)
  const syncLive = useCartStore((s) => s.syncLive)
  const productIds = items.map((item) => item.productId)

  const query = useQuery({
    queryKey: ['checkout-products', productIds.join(',')],
    queryFn: async () =>
      (
        await Promise.all(
          Array.from({ length: Math.ceil(productIds.length / 4) }, (_, index) =>
            productsApi.compare(productIds.slice(index * 4, index * 4 + 4))
          )
        )
      ).flatMap((response) => response.data.data),
    enabled: productIds.length > 0,
  })

  useEffect(() => {
    if (!query.data) return
    const changed = syncLive(query.data)
    if (changed.length) toast.info(t('cart.pricesUpdated'))
  }, [query.data, syncLive, t])

  return query
}
