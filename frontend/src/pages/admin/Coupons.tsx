import { useDeferredValue, useState } from 'react'
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
import type { Coupon, Product } from '@/types'

type CouponType = 'percent' | 'fixed' | 'price'
type PickedPrice = { product: Pick<Product, '_id' | 'name' | 'price'>; price: string }

const EMPTY = {
  code: '',
  type: 'percent' as CouponType,
  value: '10',
  minOrder: '0',
  maxUses: '100',
  perCustomerLimit: '1',
  expiresAt: '',
  productPrices: [] as PickedPrice[],
}

/** "10%", "50 DH off" or "Special price · 2 products". */
function discountLabel(c: Coupon) {
  if (c.type === 'percent') return `${c.value}% off`
  if (c.type === 'fixed') return `${formatCurrency(c.value)} off`
  const n = c.productPrices?.length ?? 0
  return `Special price · ${n} product${n === 1 ? '' : 's'}`
}

/** Products of a special-price coupon, e.g. "Laptop X → 4,500 DH". */
function specialPricesText(c: Coupon) {
  return (c.productPrices ?? [])
    .map((p) => (typeof p.product === 'object' ? `${p.product.name} → ${formatCurrency(p.price)}` : formatCurrency(p.price)))
    .join(' · ')
}

/** Coupon form: choose products and the price the customer pays for each. */
function SpecialPrices({ value, onChange }: { value: PickedPrice[]; onChange: (next: PickedPrice[]) => void }) {
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query.trim())
  const results = useQuery({
    queryKey: ['admin-products', 'coupon-search', q],
    queryFn: async () => (await adminApi.products.list({ q, limit: 8 })).data.data,
    enabled: q.length >= 2,
  })
  const picked = new Set(value.map((p) => p.product._id))
  const options = (results.data ?? []).filter((p) => !picked.has(p._id))
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Products and their special price</p>
      <div className="relative">
        <SiteIcon name="search" size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a product…"
          aria-label="Find a product"
          className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-input)] ps-9 pe-3 text-sm outline-none ring-brand"
        />
        {q.length >= 2 ? (
          <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 divide-y divide-[var(--border)] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-soft-lg">
            {options.map((p) => (
              <li key={p._id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange([...value, { product: { _id: p._id, name: p.name, price: p.price }, price: '' }])
                    setQuery('')
                  }}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-sm hover:bg-[var(--bg-muted)]"
                >
                  <span className="min-w-0 truncate">{p.name}</span>
                  <span className="shrink-0 tabular-nums text-[var(--fg-muted)]">{formatCurrency(p.price)}</span>
                </button>
              </li>
            ))}
            {!options.length ? <li className="px-3 py-2.5 text-sm text-[var(--fg-muted)]">{results.isFetching ? 'Searching…' : 'No product found.'}</li> : null}
          </ul>
        ) : null}
      </div>
      {value.length ? (
        <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
          {value.map((p, i) => {
            const n = Number(p.price)
            const saving = p.price !== '' && Number.isFinite(n) ? p.product.price - n : null
            return (
              <li key={p.product._id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
                <span className="min-w-0 flex-1 basis-40">
                  <span className="block truncate text-sm font-medium">{p.product.name}</span>
                  <span className="block text-xs text-[var(--fg-muted)]">
                    Shop price {formatCurrency(p.product.price)}
                    {saving !== null && saving > 0 ? ` · saves ${formatCurrency(saving)}` : ''}
                  </span>
                </span>
                <label className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)]">
                  Pays (DH)
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={p.price}
                    onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))}
                    className="h-9 w-28 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2 text-sm text-[var(--fg)]"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, j) => j !== i))}
                  aria-label={`Remove ${p.product.name}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:text-[var(--danger)]"
                >
                  <SiteIcon name="trash" size={14} />
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-xs text-[var(--fg-muted)]">Add the products your friend gets at a special price. Other products in the cart keep their normal price.</p>
      )}
    </div>
  )
}

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
  const isPrice = form.type === 'price'
  const badPrice = (p: PickedPrice) => p.price === '' || !Number.isFinite(Number(p.price)) || Number(p.price) < 0 || Number(p.price) >= p.product.price
  const errors = {
    code: form.code && form.code.trim().length < 3 ? '3 characters or more' : undefined,
    productPrices: !isPrice
      ? undefined
      : !form.productPrices.length
        ? 'Add at least one product'
        : form.productPrices.some(badPrice)
          ? 'Give each product a price below its shop price'
          : undefined,
    value: isPrice
      ? undefined
      : form.value === '' || !Number.isFinite(value) || value <= 0
        ? 'Enter a value above 0'
        : form.type === 'percent' && value > 100
          ? 'Max 100%'
          : undefined,
    minOrder: Number(form.minOrder) < 0 ? '0 or more' : undefined,
    maxUses: !Number.isInteger(Number(form.maxUses)) || Number(form.maxUses) < 0 ? 'Whole number, 0 = unlimited' : undefined,
    perCustomerLimit: !Number.isInteger(Number(form.perCustomerLimit)) || Number(form.perCustomerLimit) < 0 ? 'Whole number, 0 = unlimited' : undefined,
  }
  const valid = form.code.trim().length >= 3 && !Object.values(errors).some(Boolean)

  const create = useMutation({
    mutationFn: () =>
      adminApi.coupons.create({
        code: form.code.trim(),
        type: form.type,
        value: isPrice ? 0 : value,
        productPrices: isPrice ? form.productPrices.map((p) => ({ product: p.product._id, price: Number(p.price) })) : undefined,
        minOrder: Number(form.minOrder) || 0,
        maxUses: Number(form.maxUses) || 0,
        perCustomerLimit: Number(form.perCustomerLimit) || 0,
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
          className="grid grid-cols-2 gap-3 lg:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (valid) create.mutate()
          }}
        >
          <div className="col-span-2 lg:col-span-1">
          <Input
            label="Code"
            value={form.code}
            maxLength={32}
            placeholder="e.g. WELCOME10"
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '') })}
            error={errors.code}
            required
          />
          </div>
          <Select
            label="Type"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as CouponType })}
            options={[
              { value: 'percent', label: 'Percent' },
              { value: 'fixed', label: 'Fixed (DH)' },
              { value: 'price', label: 'Special price on products' },
            ]}
          />
          {isPrice ? null : (
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
          )}
          {isPrice ? (
            <div className="col-span-2 lg:col-span-3">
              <SpecialPrices value={form.productPrices} onChange={(productPrices) => setForm({ ...form, productPrices })} />
              {errors.productPrices && form.productPrices.length ? <p className="mt-1 text-xs text-[var(--danger)]">{errors.productPrices}</p> : null}
            </div>
          ) : null}
          <Input
            label="Min order (DH)"
            type="number"
            min={0}
            step="any"
            value={form.minOrder}
            onChange={(e) => setForm({ ...form, minOrder: e.target.value })}
            error={errors.minOrder}
          />
          <Input
            label="Max uses (0 = ∞)"
            type="number"
            min={0}
            step={1}
            value={form.maxUses}
            onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
            error={errors.maxUses}
          />
          <Input
            label="Uses per customer (0 = ∞)"
            type="number"
            min={0}
            step={1}
            value={form.perCustomerLimit}
            onChange={(e) => setForm({ ...form, perCustomerLimit: e.target.value })}
            error={errors.perCustomerLimit}
          />
          <div className="col-span-2 lg:col-span-1">
          <Input
            label="Expires (optional)"
            type="datetime-local"
            value={form.expiresAt}
            onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
          />
          </div>
          <div className="col-span-2 lg:col-span-3">
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
        <>
        {/* Phones: one card per coupon */}
        <ul className="space-y-2 md:hidden">
          {coupons.map((c) => {
            const state = couponState(c)
            const pending = toggle.isPending && toggle.variables?._id === c._id
            return (
              <li key={c._id} className={cn('rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3', pending && 'opacity-60')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold tracking-wide">{c.code}</p>
                    <p className="text-xs text-[var(--fg-muted)]">
                      {discountLabel(c)}
                      {c.minOrder ? ` · min ${formatCurrency(c.minOrder)}` : ''}
                    </p>
                    {c.type === 'price' ? <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">{specialPricesText(c)}</p> : null}
                  </div>
                  <Badge variant={state.variant}>{state.label}</Badge>
                </div>
                <p className="mt-1.5 text-[11px] text-[var(--fg-muted)]">
                  Used {c.usedCount}/{c.maxUses || '∞'} · {c.expiresAt ? `expires ${formatDate(c.expiresAt)}` : 'never expires'}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" disabled={pending} onClick={() => toggle.mutate(c)}>
                    {c.isActive ? 'Turn off' : 'Turn on'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteId(c._id)} aria-label={`Delete ${c.code}`}>
                    <SiteIcon name="trash" size={14} />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
        <div className="hidden min-w-0 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] md:block">
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
                    <td className="max-w-[16rem] px-4 py-3 tabular-nums">
                      {c.type === 'percent' ? `${c.value}%` : c.type === 'fixed' ? formatCurrency(c.value) : discountLabel(c)}
                      {c.type === 'price' ? <span className="block truncate text-xs text-[var(--fg-muted)]" title={specialPricesText(c)}>{specialPricesText(c)}</span> : null}
                    </td>
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
        </>
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
