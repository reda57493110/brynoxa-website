import { useState } from 'react'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { formatDate } from '@/lib/format'
import { toast } from '@/store/toastStore'

export function Customers() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const customers = useQuery({
    queryKey: ['admin-customers', { page, q }],
    queryFn: async () => {
      const res = await adminApi.customers.list({ limit: 20, page, q: q || undefined })
      return { items: res.data.data, meta: res.data.meta }
    },
    placeholderData: keepPreviousData,
  })

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApi.customers.setActive(id, isActive),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-customers'] })
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
      toast.success('Customer updated')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const items = customers.data?.items ?? []

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <AdminHeader title="Customers" description="Search accounts and disable access if needed." />

      <Input
        placeholder="Search name, email, or phone"
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setPage(1)
        }}
      />

      {customers.isPending && !customers.data ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : customers.isError ? (
        <QueryErrorState onRetry={() => customers.refetch()} />
      ) : (
        <>
          <div className="space-y-2.5 md:hidden">
            {items.map((c) => (
              <div
                key={c._id}
                className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3"
              >
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="mt-0.5 truncate text-xs text-[var(--fg-muted)]">{c.email}</p>
                    <p className="truncate text-[11px] text-[var(--fg-muted)]">
                      {c.phone || 'No phone'}
                    </p>
                  </div>
                  <Badge variant={c.isActive ? 'success' : 'danger'} className="shrink-0">
                    {c.isActive ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate text-[11px] text-[var(--fg-muted)]">
                    Joined {c.createdAt ? formatDate(c.createdAt) : '—'}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    loading={toggle.isPending}
                    onClick={() => toggle.mutate({ id: c._id, isActive: !c.isActive })}
                  >
                    {c.isActive ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              </div>
            ))}
            {!items.length ? (
              <p className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-8 text-center text-sm text-[var(--fg-muted)]">
                No customers found.
              </p>
            ) : null}
          </div>

          <div className="hidden min-w-0 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] md:block">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-[var(--bg-muted)] text-[var(--fg-muted)]">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c._id} className="border-t border-[var(--border)]">
                    <td className="max-w-[10rem] truncate px-4 py-3 font-medium">{c.name}</td>
                    <td className="max-w-[14rem] truncate px-4 py-3">{c.email}</td>
                    <td className="px-4 py-3 text-[var(--fg-muted)]">{c.phone || '—'}</td>
                    <td className="px-4 py-3">{c.createdAt ? formatDate(c.createdAt) : '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={c.isActive ? 'success' : 'danger'}>
                        {c.isActive ? 'Active' : 'Disabled'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        loading={toggle.isPending}
                        onClick={() => toggle.mutate({ id: c._id, isActive: !c.isActive })}
                      >
                        {c.isActive ? 'Disable' : 'Enable'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pages={customers.data?.meta?.pages || 1}
            onChange={setPage}
          />
        </>
      )}
    </div>
  )
}
