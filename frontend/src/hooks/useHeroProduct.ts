import { useQuery } from '@tanstack/react-query'
import { settingsApi } from '@/api/settingsApi'
import { productsApi } from '@/api/productsApi'
import { HERO_NONE, heroSettingFor, pickCategoryHero, type HeroCategory, type HeroSource } from '@/lib/heroProduct'
import type { HeroPage, Product } from '@/types'

export { HERO_NONE, heroSettingFor, pickCategoryHero, type HeroCategory, type HeroSource } from '@/lib/heroProduct'

/**
 * Product shown in a page header. Shop page with a category: the product chosen for that
 * category (or its main category); when none, one from that category (featured first); when the
 * category has nothing in stock, the shop's own header. Other pages: the product chosen in
 * admin, else the first featured product (or the newest). HERO_NONE or no page disables it (the
 * header then shows its default photo).
 */
export function useHeroProduct(
  page?: HeroPage,
  category?: HeroCategory
): {
  product: Product | null
  pending: boolean
  /** True when the product was picked in admin, false when it is the automatic fallback. */
  pinned: boolean
  /** True when admin chose to show the page photo instead of any product. */
  hidden: boolean
  /**
   * Where the product comes from: chosen for this category / its main category, picked from the
   * category, the page's own choice, the automatic pick, or none (the photo).
   */
  source: HeroSource
} {
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await settingsApi.get()).data.data,
    staleTime: 60_000,
    enabled: Boolean(page),
  })
  const cat = page === 'shop' ? category : undefined
  const pick = page ? heroSettingFor(settings.data, page, cat) : { value: '', from: 'page' as const }
  const categoryChoice = pick.from !== 'page'
  // In a category, the shop's own choice only counts when the category has nothing in stock
  const own = cat && !categoryChoice ? '' : pick.value
  const hidden = own === HERO_NONE
  const id = hidden ? '' : own

  const chosen = useQuery({
    queryKey: ['hero-product', id],
    queryFn: async () => (await productsApi.compare([id])).data.data[0] ?? null,
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
  })
  // A chosen product that is gone or sold out is replaced by the automatic pick
  const chosenUsable = Boolean(chosen.data && chosen.data.stock > 0)
  const chosenFailed = Boolean(id) && chosen.isSuccess && !chosenUsable

  // A category with nothing chosen (or a chosen product gone): one of its own products
  const wantCategory = Boolean(cat) && settings.isSuccess && !hidden && (!id || chosenFailed)
  const fromCategory = useQuery({
    queryKey: ['hero-category-products', cat?.slug],
    queryFn: async () => pickCategoryHero((await productsApi.list({ category: cat!.slug, inStock: true, sort: 'popular', limit: 12 })).data.data),
    enabled: wantCategory,
    staleTime: 5 * 60_000,
  })
  const categoryProduct = wantCategory ? (fromCategory.data ?? null) : null

  // No category (or nothing in stock in it): the page's own choice, then the automatic pick
  const pageSetting = page ? (settings.data?.pageHeroProducts?.[page] || '') : ''
  const fallBack = wantCategory && fromCategory.isSuccess && !categoryProduct
  const pageHidden = fallBack && pageSetting === HERO_NONE
  const pageId = fallBack && !pageHidden && pageSetting !== id ? pageSetting : ''
  const pageChosen = useQuery({
    queryKey: ['hero-product', pageId],
    queryFn: async () => (await productsApi.compare([pageId])).data.data[0] ?? null,
    enabled: Boolean(pageId),
    staleTime: 5 * 60_000,
  })
  const pageChosenUsable = Boolean(pageChosen.data && pageChosen.data.stock > 0)

  const needAuto =
    Boolean(page) &&
    settings.isSuccess &&
    !hidden &&
    !pageHidden &&
    (cat
      ? fallBack && (!pageId || (pageChosen.isSuccess && !pageChosenUsable))
      : !id || chosenFailed)
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

  if (!page) return { product: null, pending: false, pinned: false, hidden: false, source: 'none' }

  const pinnedProduct = (id && chosenUsable && chosen.data) || null
  const pagePinned = (pageId && pageChosenUsable && pageChosen.data) || null
  const product = pinnedProduct || categoryProduct || pagePinned || (needAuto ? (auto.data?.[0] ?? null) : null)
  return {
    product: hidden || pageHidden ? null : product,
    pending:
      settings.isPending ||
      (Boolean(id) && chosen.isPending) ||
      (wantCategory && fromCategory.isPending) ||
      (Boolean(pageId) && pageChosen.isPending) ||
      (needAuto && auto.isPending),
    pinned: Boolean(pinnedProduct || pagePinned) && (categoryChoice ? Boolean(pinnedProduct) : true),
    hidden: hidden || pageHidden,
    source:
      hidden || pageHidden || !product
        ? 'none'
        : pinnedProduct
          ? (pick.from === 'main' ? 'main' : pick.from === 'category' ? 'category' : 'page')
          : categoryProduct
            ? 'from-category'
            : pagePinned
              ? 'page'
              : 'auto',
  }
}
