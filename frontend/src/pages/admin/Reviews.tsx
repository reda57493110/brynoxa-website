import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { RatingStars } from '@/components/product/RatingStars'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { useToastStore } from '@/store/toastStore'
import type { Product, User } from '@/types'

export function Reviews() {
  const qc = useQueryClient()
  const toast = useToastStore((s) => s.push)
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)

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
    <div className="space-y-5 sm:space-y-6">
      <AdminHeader title="Reviews" description="Moderate customer feedback" />

      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {(['all', 'pending', 'approved'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`h-9 shrink-0 rounded-full border px-3 text-sm whitespace-nowrap ${
              filter === id
                ? 'border-transparent bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] text-[var(--brand-text)]'
                : 'border-[var(--border)]'
            }`}
          >
            {id === 'all' ? 'All' : id === 'pending' ? 'Hidden' : 'Approved'}
          </button>
        ))}
      </div>

      {reviews.isLoading ? (
        <Spinner />
      ) : reviews.isError ? (
        <QueryErrorState onRetry={() => reviews.refetch()} />
      ) : (
        <div className="space-y-3">
          {reviews.data
            ?.filter((r) =>
              filter === 'all' ? true : filter === 'approved' ? r.isApproved : !r.isApproved
            )
            .map((r) => {
            const product = r.product as Product
            const user = r.user as User
            return (
              <div
                key={r._id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 sm:p-5"
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
                    loading={moderate.isPending}
                    onClick={() => moderate.mutate({ id: r._id, isApproved: !r.isApproved })}
                  >
                    {r.isApproved ? 'Hide' : 'Approve'}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    loading={remove.isPending}
                    onClick={() => setDeleteId(r._id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete review?"
        description="This permanently removes the customer review."
        confirmLabel="Delete"
        loading={remove.isPending}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) remove.mutate(deleteId, { onSuccess: () => setDeleteId(null) })
        }}
      />
    </div>
  )
}
