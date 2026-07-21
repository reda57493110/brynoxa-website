import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { reviewsApi } from '@/api/reviewsApi'
import { Container } from '@/components/ui/Container'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { RatingStars } from '@/components/product/RatingStars'
import { formatDate } from '@/lib/format'
import type { Product } from '@/types'

export function AccountReviews() {
  const reviews = useQuery({
    queryKey: ['my-reviews'],
    queryFn: async () => (await reviewsApi.mine()).data.data,
  })

  return (
    <Container className="py-10">
      <h1 className="font-display text-3xl font-semibold">My reviews</h1>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">Feedback you have shared</p>

      {reviews.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : !reviews.data?.length ? (
        <div className="mt-8">
          <EmptyState
            icon={Star}
            title="No reviews yet"
            description="Review products from their detail pages after shopping."
            actionLabel="Browse shop"
            onAction={() => {
              window.location.href = '/shop'
            }}
          />
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {reviews.data.map((review) => {
            const product = review.product as Product
            return (
              <div
                key={review._id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    to={`/product/${product?.slug || ''}`}
                    className="font-semibold hover:text-[var(--brand)]"
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
  )
}
