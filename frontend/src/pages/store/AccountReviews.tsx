import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { reviewsApi } from '@/api/reviewsApi'
import { Container } from '@/components/ui/Container'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { PageHero } from '@/components/layout/PageHero'
import { surfaceCard } from '@/components/layout/pageStyles'
import { RatingStars } from '@/components/product/RatingStars'
import { formatDate } from '@/lib/format'
import { usePageTitle } from '@/hooks/usePageTitle'
import type { Product } from '@/types'

export function AccountReviews() {
  usePageTitle('My reviews — Brynoxa')
  const navigate = useNavigate()
  const reviews = useQuery({
    queryKey: ['my-reviews'],
    queryFn: async () => (await reviewsApi.mine()).data.data,
  })

  return (
    <>
      <PageHero
        kicker="Account"
        title="My reviews"
        description="Feedback you have shared on products."
      >
        <Link to="/account" className="text-sm font-medium text-[var(--brand-text)] hover:underline">
          Back to account
        </Link>
      </PageHero>
      <Container className="py-8 sm:py-10">
        {reviews.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : !reviews.data?.length ? (
          <EmptyState
            icon="star"
            title="No reviews yet"
            description="After a delivery, you can review from the product page."
            actionLabel="Browse shop"
            onAction={() => navigate('/shop')}
          />
        ) : (
          <div className="space-y-3">
            {reviews.data.map((review) => {
              const product = review.product as Product
              return (
                <div key={review._id} className={`${surfaceCard} p-5`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      to={`/product/${product?.slug || ''}`}
                      className="font-display font-semibold hover:text-[var(--brand-text)]"
                    >
                      {product?.name || 'Product'}
                    </Link>
                    <span className="text-xs text-[var(--fg-muted)]">{formatDate(review.createdAt)}</span>
                  </div>
                  <div className="mt-2">
                    <RatingStars rating={review.rating} />
                  </div>
                  <p className="mt-2 font-medium">{review.title}</p>
                  <p className="mt-1 text-sm text-[var(--fg-muted)]">{review.comment}</p>
                </div>
              )
            })}
          </div>
        )}
      </Container>
    </>
  )
}
