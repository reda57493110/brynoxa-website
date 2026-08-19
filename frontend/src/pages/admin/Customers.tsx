import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
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

  return (
    <div className="space-y-6">
      <AdminHeader title="Customers" description="Search accounts and disable access if needed." />

      <Input
        placeholder="Search name, email, or phone"
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setPage(1)
        }}
      />

      {customers.isLoading ? (
        <Spinner />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]">
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
                {customers.data?.items.map((c) => (
                  <tr key={c._id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3">{c.email}</td>
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
