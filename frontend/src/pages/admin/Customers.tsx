import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate } from '@/lib/format'
import { useToastStore } from '@/store/toastStore'

export function Customers() {
  const qc = useQueryClient()
  const toast = useToastStore((s) => s.push)

  const customers = useQuery({
    queryKey: ['admin-customers'],
    queryFn: async () => (await adminApi.customers.list({ limit: 100 })).data.data,
  })

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      adminApi.customers.setActive(id, isActive),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-customers'] })
      toast('Customer updated', 'success')
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Customers</h1>
        <p className="text-sm text-[var(--fg-muted)]">Accounts and access</p>
      </div>

      {customers.isLoading ? (
        <Spinner />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-[var(--bg-muted)] text-[var(--fg-muted)]">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {customers.data?.map((c) => (
                <tr key={c._id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3">{c.email}</td>
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
      )}
    </div>
  )
}
