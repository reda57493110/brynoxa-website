import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { Panel } from '@/components/admin/Panel'
import { toast } from '@/store/toastStore'
import { formatCurrency, formatDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Coupon } from '@/types'

const EMPTY = { code: '', type: 'percent' as 'percent' | 'fixed', value: '10', minOrder: '0', maxUses: '100', expiresAt: '' }

/** What the shop will actually do with this code right now. */
function couponState(c: Coupon): { label: string; variant: BadgeVariant } {
  if (!c.isActive) return { label: 'Off', variant: 'muted' }
  if (c.expiresAt && new Date(c.expiresAt).getTime() < Date.now()) return { label: 'Expired', variant: 'danger' }
  if (c.maxUses > 0 && c.usedCount >= c.maxUses) return { label: 'Used up', variant: 'warning' }
  if (c.startsAt && new Date(c.startsAt).getTime() > Date.now()) return { label: 'Scheduled', variant: 'brand' }
  return { label: 'Active', variant: 'success' }
}

export function Coupons() {
  const qc = useQueryClient()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY)

  const list = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: async () => (await adminApi.coupons.list()).data.data,
  })

  const value = Number(form.value)
  const errors = {
    code: form.code && form.code.trim().length < 3 ? '3 characters or more' : undefined,
    value:
      form.value === '' || !Number.isFinite(value) || value <= 0
        ? 'Enter a value above 0'
        : form.type === 'percent' && value > 100
          ? 'Max 100%'
          : undefined,
    minOrder: Number(form.minOrder) < 0 ? '0 or more' : undefined,
    maxUses: !Number.isInteger(Number(form.maxUses)) || Number(form.maxUses) < 0 ? 'Whole number, 0 = unlimited' : undefined,
  }
  const valid = form.code.trim().length >= 3 && !Object.values(errors).some(Boolean)

  const create = useMutation({
    mutationFn: () =>
      adminApi.coupons.create({
        code: form.code.trim(),
        type: form.type,
        value,
        minOrder: Number(form.minOrder) || 0,
        maxUses: Number(form.maxUses) || 0,
        expiresAt: form.expiresAt || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-coupons'] })
      setForm(EMPTY)
      toast.success('Coupon created')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.coupons.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-coupons'] })
      setDeleteId(null)
      toast.success('Coupon deleted')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const toggle = useMutation({
    mutationFn: (c: { _id: string; isActive: boolean }) => adminApi.coupons.update(c._id, { isActive: !c.isActive }),
    onSuccess: (_r, c) => {
      qc.invalidateQueries({ queryKey: ['admin-coupons'] })
      toast.success(c.isActive ? 'Coupon turned off' : 'Coupon turned on')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const coupons = list.data ?? []

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <AdminHeader title="Coupons" description="Discount codes customers enter at checkout." />

      <Panel title="New coupon">
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (valid) create.mutate()
          }}
        >
          <Input
            label="Code"
            value={form.code}
            maxLength={32}
            placeholder="e.g. WELCOME10"
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })}
            error={errors.code}
            required
          />
          <Select
            label="Discount type"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as 'percent' | 'fixed' })}
            options={[
              { value: 'percent', label: 'Percent of the order' },
              { value: 'fixed', label: 'Fixed amount (DH)' },
            ]}
          />
          <Input
            label={form.type === 'percent' ? 'Discount (%)' : 'Discount (DH)'}
            type="number"
            min={0}
            max={form.type === 'percent' ? 100 : undefined}
            step="any"
            value={form.value}
            onChange={(e) => setForm({ ...form, value: e.target.value })}
            error={errors.value}
          />
          <Input
            label="Minimum order (DH)"
            type="number"
            min={0}
            step="any"
            value={form.minOrder}
            onChange={(e) => setForm({ ...form, minOrder: e.target.value })}
            error={errors.minOrder}
          />
          <Input
            label="Maximum uses (0 = unlimited)"
            type="number"
            min={0}
            step={1}
            value={form.maxUses}
            onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
            error={errors.maxUses}
          />
          <Input
            label="Expires (optional)"
            type="datetime-local"
            value={form.expiresAt}
            onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
          />
          <div className="sm:col-span-2 lg:col-span-3">
            <Button type="submit" loading={create.isPending} disabled={!valid}>
              <SiteIcon name="plus" size={14} /> Create coupon
            </Button>
          </div>
        </form>
      </Panel>

      {list.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : list.isError ? (
        <QueryErrorState onRetry={() => list.refetch()} />
      ) : coupons.length ? (
        <div className="min-w-0 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-[var(--bg-muted)] text-left text-xs text-[var(--fg-muted)]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Code</th>
                <th className="px-4 py-2.5 font-medium">Discount</th>
                <th className="px-4 py-2.5 font-medium">Min order</th>
                <th className="px-4 py-2.5 font-medium">Used</th>
                <th className="px-4 py-2.5 font-medium">Expires</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => {
                const state = couponState(c)
                const pending = toggle.isPending && toggle.variables?._id === c._id
                const usedPct = c.maxUses > 0 ? Math.min(100, (c.usedCount / c.maxUses) * 100) : 0
                return (
                  <tr key={c._id} className={cn('border-t border-[var(--border)]', pending && 'opacity-60')}>
                    <td className="px-4 py-3 font-semibold tracking-wide">{c.code}</td>
                    <td className="px-4 py-3 tabular-nums">{c.type === 'percent' ? `${c.value}%` : formatCurrency(c.value)}</td>
                    <td className="px-4 py-3 tabular-nums text-[var(--fg-muted)]">{c.minOrder ? formatCurrency(c.minOrder) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className="tabular-nums">
                        {c.usedCount}/{c.maxUses || '∞'}
                      </span>
                      {c.maxUses > 0 ? (
                        <span className="mt-1 block h-1 w-16 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                          <span className="block h-full bg-[var(--brand)]" style={{ width: `${usedPct}%` }} />
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-[var(--fg-muted)]">{c.expiresAt ? formatDate(c.expiresAt) : 'Never'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={state.variant}>{state.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" disabled={pending} onClick={() => toggle.mutate(c)}>
                          {c.isActive ? 'Turn off' : 'Turn on'}
                        </Button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(c._id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:text-[var(--danger)]"
                          aria-label={`Delete ${c.code}`}
                        >
                          <SiteIcon name="trash" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--fg-muted)]">
          No coupons yet — create your first above.
        </p>
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete coupon?"
        description="This cannot be undone. Past orders keep their recorded discount."
        confirmLabel="Delete"
        loading={remove.isPending}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && remove.mutate(deleteId)}
      />
    </div>
  )
}
