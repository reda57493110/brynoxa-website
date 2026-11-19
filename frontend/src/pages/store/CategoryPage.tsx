import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { categoriesApi } from '@/api/categoriesApi'
import { Container } from '@/components/ui/Container'
import { EmptyState } from '@/components/ui/EmptyState'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { useT } from '@/hooks/useT'
import { Shop } from './Shop'

/**
 * A category page (/category/laptops): the shop with that category chosen — same banner, cards,
 * filters and grid / list — under the category's own address (the one Google keeps). A category
 * that does not exist shows "Category not found".
 */
export function CategoryPage() {
  const t = useT()
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const category = useQuery({
    queryKey: ['category', slug],
    queryFn: async () => (await categoriesApi.getBySlug(slug)).data.data,
    enabled: Boolean(slug),
  })

  if (category.isError) {
    return (
      <Container className="py-8 sm:py-10">
        <QueryErrorState title={t('shop.loadError')} description={t('shop.loadErrorBody')} onRetry={() => category.refetch()} />
      </Container>
    )
  }
  if (!category.isPending && !category.data) {
    return (
      <Container className="py-8 sm:py-10">
        <EmptyState title={t('shop.categoryMissing')} description={t('shop.categoryMissingBody')} actionLabel={t('shop.backToShop')} onAction={() => navigate('/shop')} />
      </Container>
    )
  }
  return <Shop categorySlug={slug} />
}
