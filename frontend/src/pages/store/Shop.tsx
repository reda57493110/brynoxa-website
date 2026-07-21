import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { SlidersHorizontal } from 'lucide-react'
import { productsApi } from '@/api/productsApi'
import { categoriesApi } from '@/api/categoriesApi'
import { brandsApi } from '@/api/brandsApi'
import { Container } from '@/components/ui/Container'
import { ProductGrid } from '@/components/product/ProductGrid'
import { FilterSidebar, type FilterValues } from '@/components/product/FilterSidebar'
import { SortSelect } from '@/components/product/SortSelect'
import { Pagination } from '@/components/ui/Pagination'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'

export function Shop() {
  const [params, setParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)

  const filters = useMemo(
    () => ({
      page: Number(params.get('page') || 1),
      limit: 12,
      sort: params.get('sort') || 'newest',
      q: params.get('q') || undefined,
      category: params.get('category') || undefined,
      brand: params.get('brand') || undefined,
      minPrice: params.get('minPrice') ? Number(params.get('minPrice')) : undefined,
      maxPrice: params.get('maxPrice') ? Number(params.get('maxPrice')) : undefined,
    }),
    [params]
  )

  const products = useQuery({
    queryKey: ['products', filters],
    queryFn: async () => {
      const res = await productsApi.list(filters)
      return { items: res.data.data, meta: res.data.meta }
    },
  })
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await categoriesApi.list()).data.data,
  })
  const brands = useQuery({
    queryKey: ['brands'],
    queryFn: async () => (await brandsApi.list()).data.data,
  })

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => {
      if (!v) next.delete(k)
      else next.set(k, v)
    })
    if (!('page' in patch)) next.set('page', '1')
    setParams(next)
  }

  const filterValues: FilterValues = {
    category: filters.category,
    brand: filters.brand,
    minPrice: params.get('minPrice') || undefined,
    maxPrice: params.get('maxPrice') || undefined,
  }

  const onFilterChange = (next: FilterValues) => {
    update({
      category: next.category,
      brand: next.brand,
      minPrice: next.minPrice,
      maxPrice: next.maxPrice,
    })
  }

  const sidebar = (
    <FilterSidebar
      categories={categories.data || []}
      brands={brands.data || []}
      values={filterValues}
      onChange={onFilterChange}
      onClear={() => {
        const next = new URLSearchParams()
        if (filters.q) next.set('q', filters.q)
        if (filters.sort) next.set('sort', filters.sort)
        setParams(next)
      }}
    />
  )

  return (
    <Container className="py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">Shop</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            {products.data?.meta?.total ?? 0} products
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </Button>
          <SortSelect value={filters.sort} onChange={(sort) => update({ sort })} />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <div className="hidden lg:block">{sidebar}</div>
        <div>
          <ProductGrid products={products.data?.items} loading={products.isLoading} />
          <Pagination
            page={filters.page}
            pages={products.data?.meta?.pages || 1}
            onChange={(page) => update({ page: String(page) })}
          />
        </div>
      </div>

      <Drawer open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters" side="left">
        {sidebar}
      </Drawer>
    </Container>
  )
}
