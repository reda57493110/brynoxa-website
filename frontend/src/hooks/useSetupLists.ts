import { useQueries, useQuery } from '@tanstack/react-query'
import { productsApi } from '@/api/productsApi'
import { settingsApi } from '@/api/settingsApi'
import { SETUP_IDS, SETUP_PIECES, categorySlugOf, setupPieceOf, setupsFor, type SetupId, type SetupPiece } from '@/lib/setups'
import type { Product } from '@/types'

/** Products a setup can hold when staff choose them (same as the server, MAX_SETUP_ROW) */
export const MAX_SETUP_ROW = 48
/** Products asked for per automatic setup (the server's page size limit) */
const SETUP_LIMIT = 100

export const setupRowKey = (id: SetupId) => `setup-${id}` as const

export type SetupList = {
  id: SetupId
  /** In stock, in order: staff's order when chosen, otherwise best sellers first */
  items: Product[]
  /** Chosen in Admin → Products (Setups board), not automatic */
  pinned: boolean
  pending: boolean
  /** The groups shown on the page, in the setup's order, without empty ones */
  groups: { piece: SetupPiece; items: Product[] }[]
}

export function groupSetup(id: SetupId, items: Product[]) {
  return SETUP_PIECES[id]
    .map((piece) => ({ piece, items: items.filter((p) => setupPieceOf(categorySlugOf(p)) === piece) }))
    .filter((g) => g.items.length)
}

/**
 * The four setups of the "Pick your setup" page — one place for the shop page and the admin
 * board. A setup shows the products staff chose (Settings → homeRows['setup-gaming'] …, in that
 * order), or when none, fills itself: products ticked for it, or by category and their own words
 * (lib/setups.ts setupsFor).
 */
export function useSetupLists(): Record<SetupId, SetupList> {
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await settingsApi.get()).data.data,
    staleTime: 60_000,
  })
  const chosen = settings.data?.homeRows ?? {}

  const auto = useQueries({
    queries: SETUP_IDS.map((id) => ({
      queryKey: ['products', 'setup', id],
      // The server sends the setup's categories; the product's own words decide inside shared ones
      queryFn: async () =>
        (await productsApi.list({ setup: id, inStock: true, sort: 'popular', limit: SETUP_LIMIT })).data.data.filter((p) => setupsFor(p).includes(id)),
      staleTime: 60_000,
    })),
  })
  const pinnedIds = SETUP_IDS.map((id) => chosen[setupRowKey(id)] ?? [])
  const pinned = useQueries({
    queries: SETUP_IDS.map((id, i) => ({
      queryKey: ['products', 'setup-pinned', id, pinnedIds[i].join(',')],
      queryFn: async () => (await productsApi.list({ ids: pinnedIds[i].join(','), limit: MAX_SETUP_ROW })).data.data,
      enabled: pinnedIds[i].length > 0,
      staleTime: 60_000,
    })),
  })

  return Object.fromEntries(
    SETUP_IDS.map((id, i) => {
      const isPinned = pinnedIds[i].length > 0
      let items: Product[]
      if (isPinned) {
        const byId = new Map((pinned[i].data ?? []).map((p) => [p._id, p]))
        items = pinnedIds[i].map((pid) => byId.get(pid)).filter((p): p is Product => Boolean(p && p.stock > 0))
      } else {
        items = auto[i].data ?? []
      }
      const pending = settings.isPending || (isPinned ? pinned[i].isPending : auto[i].isPending)
      return [id, { id, items, pinned: isPinned, pending, groups: groupSetup(id, items) }]
    })
  ) as Record<SetupId, SetupList>
}
