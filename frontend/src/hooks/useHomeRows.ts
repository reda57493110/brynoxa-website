import { useQuery } from '@tanstack/react-query'
import { productsApi } from '@/api/productsApi'
import { BUDGETS, inBudget } from '@/lib/homeRows'
import type { Product } from '@/types'

/**
 * The automatic home sections under Featured: Deals, New arrivals and Shop by budget. One place
 * for the home page and Admin → Products (Home page board), so both always show the same
 * products. `shownAbove`: products already on the page higher up (top deals, Featured, carousel),
 * never repeated in Deals / New arrivals.
 */
export function useHomeRows(shownAbove: Product[]) {
  const onSale = useQuery({
    queryKey: ['products', 'home-deals-row'],
    queryFn: async () => (await productsApi.list({ onSale: true, inStock: true, limit: 16 })).data.data,
  })
  const newest = useQuery({
    queryKey: ['products', 'home-new-row'],
    queryFn: async () => (await productsApi.list({ sort: 'newest', inStock: true, limit: 16 })).data.data,
  })
  const budget = useQuery({
    queryKey: ['products', 'home-budget'],
    queryFn: async () => (await productsApi.list({ inStock: true, sort: 'price_asc', limit: 60 })).data.data,
  })

  const above = new Set(shownAbove.map((p) => p._id))
  const deals = (onSale.data ?? []).filter((p) => !above.has(p._id)).slice(0, 12)
  const dealIds = new Set(deals.map((p) => p._id))
  const newArrivals = (newest.data ?? []).filter((p) => !above.has(p._id) && !dealIds.has(p._id)).slice(0, 12)
  const budgetAll = budget.data ?? []
  const budgets = BUDGETS.map((b) => ({ ...b, items: budgetAll.filter((p) => inBudget(p.price, b)) }))

  return {
    deals,
    newArrivals,
    /** Every band, also the empty ones (the home page hides those) */
    budgets,
    budgetTotal: budgetAll.length,
    ready: !onSale.isPending && !newest.isPending && !budget.isPending,
  }
}
