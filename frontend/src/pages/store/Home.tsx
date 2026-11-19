import { useQuery } from '@tanstack/react-query'
import { productsApi } from '@/api/productsApi'
import { categoriesApi } from '@/api/categoriesApi'
import { useHomeDeals } from '@/hooks/useHomeDeals'
import { useHomeRows } from '@/hooks/useHomeRows'
import { HomeHero } from '@/components/home/HomeHero'
import { HomeTrustBar } from '@/components/home/HomeTrustBar'
import {
  HomeBrands,
  HomeBudgetCards,
  HomeCategoryTabs,
  HomeDealsBlock,
  HomeIntro,
  HomeSelection,
  HomeSetupsBand,
  HomeSignatureBanner,
  SIGNATURE_PHOTO,
} from '@/components/home/HomeBlocks'
import { mainCategories } from '@/lib/categoryTree'
import { canonicalCategorySlug } from '@/lib/categorySlug'
import { useT } from '@/hooks/useT'
import { useSeo } from '@/hooks/useSeo'
import { organizationData } from '@/lib/structuredData'
import type { Product } from '@/types'

/** Categories shown first, in this order (by address): Desktop PC, Laptops, Gaming PCs, Monitors */
const HOME_CATEGORIES = ['desktop-pcs', 'laptops', 'gaming-pcs', 'monitors']
/** Then the other main categories with products, up to this many in all */
const HOME_CATEGORY_MAX = 8

const unique = (list: Product[]) => list.filter((p, i, all) => all.findIndex((q) => q._id === p._id) === i)

/**
 * Home page, in the style of the big Moroccan PC shops (Brynoxa colours):
 * 1. categories menu · deals banner · two photo tiles
 * 2. the promises strip (cash on delivery, delivery, returns, WhatsApp)
 * 3. the page title and the categories as round photos
 * 4. Deals of the moment
 * 5. Our selection: Top picks / New arrivals / Best sellers
 * 6. Brynoxa Signature banner and its products
 * 7. Products by category (a tab per category)
 * 8. Shop by budget
 * 9. Find your next setup
 * 10. Our brands
 * Every list staff choose in Admin → Products → Home page still feeds the same place.
 */
export function Home() {
  const t = useT()

  // Admin → Products → Home page deals (up to 4; automatic: best in-stock featured deals)
  const deals = useHomeDeals()

  const featured = useQuery({
    queryKey: ['products', 'featured'],
    queryFn: async () => (await productsApi.list({ featured: true, limit: 4 })).data.data,
  })
  const carousel = useQuery({
    queryKey: ['products', 'carousel'],
    queryFn: async () => (await productsApi.list({ carousel: true, limit: 12 })).data.data,
  })

  // Deals, New arrivals, Signature, budgets: chosen in admin or automatic (same hook as the admin board)
  const rows = useHomeRows([...deals.products, ...(featured.data ?? []), ...(carousel.data ?? [])])

  // Top picks: the featured products first, then the carousel ones (each once)
  const topPicks = unique([...(featured.data ?? []), ...(carousel.data ?? [])])

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await categoriesApi.list()).data.data,
  })

  useSeo({
    title: t('meta.homeTitle'),
    description: t('meta.homeDescription'),
    path: '/',
    image: SIGNATURE_PHOTO,
    jsonLd: organizationData(),
  })

  // Main categories only; the shop only lists categories that have products, so none is empty
  const categoryList = mainCategories((categories.data ?? []).filter((c) => c.slug !== 'office' && c.slug !== 'networking'))
  const chosen = HOME_CATEGORIES.map((slug) => categoryList.find((c) => canonicalCategorySlug(c.slug) === slug)).filter(
    (c): c is (typeof categoryList)[number] => Boolean(c)
  )
  const homeCategories = [...chosen, ...categoryList.filter((c) => !c.parent && !chosen.includes(c))].slice(0, HOME_CATEGORY_MAX)

  return (
    <>
      <HomeHero
        deals={deals.products}
        dealsPending={deals.pending}
        categories={homeCategories}
        categoriesLoading={categories.isLoading}
        onSale={rows.deals}
      />

      <HomeTrustBar />

      {/* Categories: the page title, then the categories as round photos */}
      <HomeIntro categories={homeCategories} loading={categories.isLoading} error={categories.isError} onRetry={() => categories.refetch()} />

      <HomeDealsBlock products={rows.deals} />

      {/* Featured */}
      <HomeSelection
        picks={topPicks}
        newArrivals={rows.newArrivals}
        pending={featured.isPending || carousel.isPending}
        error={featured.isError || carousel.isError}
        onRetry={() => {
          featured.refetch()
          carousel.refetch()
        }}
      />

      <HomeSignatureBanner products={rows.signature} />

      <HomeCategoryTabs categories={homeCategories.slice(0, 6)} />

      <HomeBudgetCards budgets={rows.budgets} />

      <HomeSetupsBand />

      <HomeBrands products={unique([...deals.products, ...topPicks, ...rows.deals, ...rows.newArrivals, ...rows.budgets.flatMap((b) => b.items)])} />
    </>
  )
}
