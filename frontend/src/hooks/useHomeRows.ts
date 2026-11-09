import { useQuery } from '@tanstack/react-query'
import { productsApi } from '@/api/productsApi'
import { settingsApi } from '@/api/settingsApi'
import { BUDGETS, inBudget } from '@/lib/homeRows'
import type { Product } from '@/types'

/** Home sections staff can choose and order (Settings → homeRows); same keys as the server. */
export type HomeRowKey = 'deals' | 'new' | 'budget-small' | 'budget-mid' | 'budget-high'
export const budgetKey = (id: string) => `budget-${id}` as HomeRowKey

/** The products staff chose for one section, in their order (sold out / hidden ones skipped). */
function usePinned(key: HomeRowKey, ids: string[] | undefined) {
  const list = ids ?? []
  const q = useQuery({
    queryKey: ['products', 'home-rows-pinned', key, list.join(',')],
    queryFn: async () => (await productsApi.list({ ids: list.join(','), limit: 12 })).data.data,
    enabled: list.length > 0,
  })
  const byId = new Map((q.data ?? []).map((p) => [p._id, p]))
  return {
    pinned: list.length > 0,
    products: list.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p && p.stock > 0)),
    pending: list.length > 0 && q.isPending,
  }
}

/**
 * The home sections under Featured: Deals, New arrivals and Shop by budget. One place for the
 * home page and Admin → Products (Home page board), so both always show the same products.
 * Each section uses the products staff chose (in their order) or, when none, fills itself:
 * Deals = old price above the price, New arrivals = latest, budget tabs = by price.
 * `shownAbove`: products already higher on the page, never repeated in automatic Deals / New.
 */
export function useHomeRows(shownAbove: Product[]) {
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await settingsApi.get()).data.data,
    staleTime: 60_000,
  })
  const chosen = settings.data?.homeRows ?? {}

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
  const pinnedDeals = usePinned('deals', chosen.deals)
  const pinnedNew = usePinned('new', chosen.new)
  const pinnedSmall = usePinned('budget-small', chosen['budget-small'])
  const pinnedMid = usePinned('budget-mid', chosen['budget-mid'])
  const pinnedHigh = usePinned('budget-high', chosen['budget-high'])
  const pinnedBudget = { small: pinnedSmall, mid: pinnedMid, high: pinnedHigh } as Record<string, ReturnType<typeof usePinned>>

  const above = new Set(shownAbove.map((p) => p._id))
  const deals = pinnedDeals.pinned ? pinnedDeals.products : (onSale.data ?? []).filter((p) => !above.has(p._id)).slice(0, 12)
  const dealIds = new Set(deals.map((p) => p._id))
  const newArrivals = pinnedNew.pinned
    ? pinnedNew.products
    : (newest.data ?? []).filter((p) => !above.has(p._id) && !dealIds.has(p._id)).slice(0, 12)
  const budgetAll = budget.data ?? []
  const budgets = BUDGETS.map((b) => {
    const mine = pinnedBudget[b.id]
    return { ...b, key: budgetKey(b.id), pinned: Boolean(mine?.pinned), items: mine?.pinned ? mine.products : budgetAll.filter((p) => inBudget(p.price, b)) }
  })

  return {
    deals,
    dealsPinned: pinnedDeals.pinned,
    newArrivals,
    newPinned: pinnedNew.pinned,
    /** Every band, also the empty ones (the home page hides those) */
    budgets,
    budgetTotal: budgetAll.length,
    ready:
      !settings.isPending &&
      !onSale.isPending &&
      !newest.isPending &&
      !budget.isPending &&
      ![pinnedDeals, pinnedNew, pinnedSmall, pinnedMid, pinnedHigh].some((p) => p.pending),
  }
}
