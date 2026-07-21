import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { RatingStars } from '@/components/product/RatingStars'
import { useToastStore } from '@/store/toastStore'
import type { Product, User } from '@/types'

export function Reviews() {
  const qc = useQueryClient()
  const toast = useToastStore((s) => s.push)

  const reviews = useQuery({
    queryKey: ['admin-reviews'],
    queryFn: async () => (await adminApi.reviews.list({ limit: 50 })).data.data,
  })

  const moderate = useMutation({
    mutationFn: ({ id, isApproved }: { id: string; isApproved: boolean }) =>
      adminApi.reviews.moderate(id, isApproved),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-reviews'] })
      toast('Review updated', 'success')
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.reviews.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-reviews'] })
      toast('Review deleted', 'success')
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Reviews</h1>
        <p className="text-sm text-[var(--fg-muted)]">Moderate customer feedback</p>
      </div>

      {reviews.isLoading ? (
        <Spinner />
      ) : (
        <div className="space-y-3">
          {reviews.data?.map((r) => {
            const product = r.product as Product
            const user = r.user as User
            return (
              <div
                key={r._id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{product?.name || 'Product'}</p>
                    <p className="text-sm text-[var(--fg-muted)]">by {user?.name || 'User'}</p>
                    <div className="mt-1">
                      <RatingStars rating={r.rating} />
                    </div>
                    <p className="mt-2 font-medium">{r.title}</p>
                    <p className="text-sm text-[var(--fg-muted)]">{r.comment}</p>
                  </div>
                  <Badge variant={r.isApproved ? 'success' : 'warning'}>
                    {r.isApproved ? 'Approved' : 'Hidden'}
                  </Badge>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => moderate.mutate({ id: r._id, isApproved: !r.isApproved })}
                  >
                    {r.isApproved ? 'Hide' : 'Approve'}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => confirm('Delete review?') && remove.mutate(r._id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
