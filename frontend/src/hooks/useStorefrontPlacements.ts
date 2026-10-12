import { useQuery } from '@tanstack/react-query'
import { productsApi } from '@/api/productsApi'
import { settingsApi } from '@/api/settingsApi'
import { useHeroProduct } from '@/hooks/useHeroProduct'
import { MAX_HOME_DEALS, useHomeDeals } from '@/hooks/useHomeDeals'
import type { Product } from '@/types'

/** Same limits as the home page (pages/store/Home.tsx). */
export const HOME_FEATURED_LIMIT = 4
export const HOME_ROW_LIMIT = 12

export type PlacementKey = 'deals' | 'spotlight' | 'row' | 'shopHeader' | 'category' | 'featuredWaiting' | 'carouselWaiting' | 'hidden'

export interface Placement {
  key: PlacementKey
  label: string
  /** Position inside the section, e.g. "#2" */
  detail?: string
  /** Picked automatically (no manual choice in admin) */
  auto?: boolean
  /** Flagged but not actually shown (e.g. featured behind newer ones) */
  waiting?: boolean
  /** Storefront page that shows it */
  href?: string
}

/**
 * Where products really appear on the storefront, computed from the same data and rules the
 * storefront uses: home deals (Settings, or automatic), the home "Featured" section (the most
 * recent featured product as the big card, then the carousel products — or the next featured
 * ones when there are none), the Shop page header, and the product's category page.
 */
export function useStorefrontPlacements() {
  const deals = useHomeDeals()
  const shopHero = useHeroProduct('shop')
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await settingsApi.get()).data.data,
    staleTime: 60_000,
  })
  // Same query keys and limits as the home page, so this is exactly what customers see
  const featured = useQuery({
    queryKey: ['products', 'featured'],
    queryFn: async () => (await productsApi.list({ featured: true, limit: HOME_FEATURED_LIMIT })).data.data,
  })
  const carousel = useQuery({
    queryKey: ['products', 'carousel'],
    queryFn: async () => (await productsApi.list({ carousel: true, limit: HOME_ROW_LIMIT })).data.data,
  })

  const featuredList = featured.data ?? []
  const row = carousel.data?.length ? carousel.data : featuredList.slice(1)
  const rowFromCarousel = Boolean(carousel.data?.length)
  const pinnedDeals = settings.data?.homeDeals ?? []

  const placementsOf = (p: Product): Placement[] => {
    const out: Placement[] = []
    if (!p.isActive) return [{ key: 'hidden', label: 'Hidden — not on the storefront' }]

    const dealIndex = deals.products.findIndex((d) => d._id === p._id)
    if (dealIndex >= 0) {
      out.push({ key: 'deals', label: 'Home · Top deals', detail: `#${dealIndex + 1}`, auto: !deals.pinned, href: '/' })
    } else if (pinnedDeals.includes(p._id)) {
      out.push({ key: 'deals', label: 'Home · Top deals', detail: 'skipped (sold out)', waiting: true, href: '/' })
    }

    if (featuredList[0]?._id === p._id) {
      out.push({ key: 'spotlight', label: 'Home · Featured card', href: '/#featured' })
    }
    const rowIndex = row.findIndex((r) => r._id === p._id)
    if (rowIndex >= 0) out.push({ key: 'row', label: 'Home · Featured row', detail: `#${rowIndex + 1}`, href: '/#featured' })

    // Flagged but not visible: newer featured / carousel products take the limited places
    const shownAsFeatured = featuredList[0]?._id === p._id || (!rowFromCarousel && rowIndex >= 0)
    if (p.isFeatured && !shownAsFeatured) {
      out.push({ key: 'featuredWaiting', label: 'Featured · not shown', waiting: true })
    }
    if (p.isCarousel && !(rowFromCarousel && rowIndex >= 0)) {
      out.push({ key: 'carouselWaiting', label: 'Featured row · not shown', waiting: true })
    }

    if (shopHero.product?._id === p._id) {
      out.push({ key: 'shopHeader', label: 'Shop · Header', auto: !shopHero.pinned, href: '/shop' })
    }

    const cat = typeof p.category === 'object' && p.category ? p.category : null
    if (cat) {
      out.push({
        key: 'category',
        label: cat.isActive === false ? `Category · ${cat.name} (hidden)` : `Category · ${cat.name}`,
        waiting: cat.isActive === false,
        href: `/category/${cat.slug}`,
      })
    }
    return out
  }

  return {
    placementsOf,
    ready: !featured.isPending && !carousel.isPending && !deals.pending,
    deals,
    pinnedDeals,
    dealsFull: pinnedDeals.length >= MAX_HOME_DEALS,
    featuredList,
    row,
    rowFromCarousel,
    shopHero,
    shopHeroSetting: settings.data?.pageHeroProducts?.shop || '',
  }
}
