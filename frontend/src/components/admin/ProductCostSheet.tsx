import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { categoriesApi } from '@/api/categoriesApi'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { SafeImage } from '@/components/ui/SafeImage'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { Panel } from '@/components/admin/Panel'
import { formatCurrency } from '@/lib/format'
import { optimizedImageUrl } from '@/lib/image'
import { cn } from '@/lib/cn'
import { toast } from '@/store/toastStore'
import type { ProductCostSheet as Sheet } from '@/types'

type Row = Sheet['items'][number]

/** '' → null, bad → undefined */
function parse(v: string): number | null | undefined {
  const s = v.trim().replace(',', '.')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}
const str = (n: number | null | undefined) => (typeof n === 'number' ? String(n) : '')

function profitOf(price: number, cost: number, delivery: number, other: number, fees = 0) {
  const profit = price - cost - delivery - other - fees
  return { profit, margin: price > 0 ? Math.round((profit / price) * 1000) / 10 : null }
}

function ProfitValue({ profit, margin }: { profit: number; margin: number | null }) {
  return (
    <span className="whitespace-nowrap text-right">
      <span className={cn('block font-semibold tabular-nums', profit < 0 ? 'text-[var(--danger)]' : 'text-[var(--success)]')}>
        {profit < 0 ? `−${formatCurrency(-profit)}` : formatCurrency(profit)}
      </span>
      {margin !== null ? <span className="block text-[10px] text-[var(--fg-muted)]">{margin}% margin</span> : null}
    </span>
  )
}

const numInput =
  'h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 text-right text-sm tabular-nums outline-none focus:border-[var(--brand)]'

/** Try a price before adding it: what is left on one sale. */
function Calculator({ courier }: { courier: number }) {
  const [price, setPrice] = useState('')
  const [cost, setCost] = useState('')
  const [delivery, setDelivery] = useState('')
  const [fees, setFees] = useState('')
  const [other, setOther] = useState('')
  const n = (v: string, fallback = 0) => parse(v) ?? fallback
  const p = n(price)
  const r = profitOf(p, n(cost), n(delivery, courier), n(other), n(fees))
  return (
    <Panel title="Quick calculator" description="Try a selling price: what is left for you on one sale." compact>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Input label="Sells for (DH)" inputMode="decimal" placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} />
        <Input label="Bought for (DH)" inputMode="decimal" placeholder="0" value={cost} onChange={(e) => setCost(e.target.value)} />
        <Input label="Delivery (DH)" inputMode="decimal" placeholder={String(courier)} value={delivery} onChange={(e) => setDelivery(e.target.value)} />
        <Input label="Transfer fees (DH)" inputMode="decimal" placeholder="0" value={fees} onChange={(e) => setFees(e.target.value)} />
        <Input label="Other (DH)" inputMode="decimal" placeholder="Packaging…" value={other} onChange={(e) => setOther(e.target.value)} />
      </div>
      <div className="flex items-center justify-between rounded-xl bg-[var(--bg-muted)] px-3 py-2.5 text-sm">
        <span className="text-[var(--fg-muted)]">You keep</span>
        {p > 0 ? <ProfitValue {...r} /> : <span className="text-[var(--fg-muted)]">Enter a selling price</span>}
      </div>
    </Panel>
  )
}

function CostRow({ row, courier }: { row: Row; courier: number }) {
  const qc = useQueryClient()
  const [cost, setCost] = useState(str(row.costPrice))
  const [delivery, setDelivery] = useState(str(row.delivery))
  const [other, setOther] = useState(str(row.other))
  useEffect(() => {
    setCost(str(row.costPrice))
    setDelivery(str(row.delivery))
    setOther(str(row.other))
  }, [row.costPrice, row.delivery, row.other])

  const c = parse(cost)
  const d = parse(delivery)
  const o = parse(other)
  const invalid = c === undefined || d === undefined || o === undefined
  const dirty = str(c ?? null) !== str(row.costPrice) || str(d ?? null) !== str(row.delivery) || str(o ?? null) !== str(row.other)
  const r = typeof c === 'number' ? profitOf(row.price, c, d ?? courier, o ?? 0) : null

  const save = useMutation({
    mutationFn: () =>
      adminApi.profit.setProductCost(row.productId, {
        ...(str(c ?? null) !== str(row.costPrice) ? { costPrice: c ?? null } : {}),
        delivery: d ?? null,
        other: o ?? null,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-profit'] })
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
      const n = res.data.data.ordersUpdated
      toast.success(n ? `Saved · ${n} past order${n === 1 ? '' : 's'} updated` : 'Costs saved')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <li className="grid grid-cols-3 items-center gap-x-2 gap-y-2 py-2.5 sm:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_6.5rem_7rem_4.5rem]">
      <div className="col-span-3 flex min-w-0 items-center gap-2.5 sm:col-span-1">
        <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-muted)]">
          {row.image ? <SafeImage src={optimizedImageUrl(row.image, 96)} alt="" className="size-full object-cover" /> : null}
        </span>
        <div className="min-w-0 flex-1">
          <Link to={`/admin/products/${row.productId}/edit`} className="line-clamp-1 text-sm font-medium hover:text-[var(--brand-text)]">
            {row.name}
          </Link>
          <p className="truncate text-[11px] text-[var(--fg-muted)]">
            Sells for <span className="font-medium text-[var(--fg)]">{formatCurrency(row.price)}</span>
            {row.category ? ` · ${row.category}` : ''}
            {!row.isActive ? ' · hidden' : ''}
          </p>
        </div>
        {/* Phones: result next to the name */}
        <span className="sm:hidden">{r ? <ProfitValue {...r} /> : <span className="text-[11px] text-[var(--warning)]">No cost</span>}</span>
      </div>
      <label className="min-w-0 text-[10px] text-[var(--fg-muted)]">
        <span className="sm:sr-only">Bought for</span>
        <input
          inputMode="decimal"
          aria-label="Bought for (DH)"
          placeholder="Bought for"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          className={cn(numInput, c === null && 'border-[color-mix(in_srgb,var(--warning)_60%,var(--border))]')}
        />
      </label>
      <label className="min-w-0 text-[10px] text-[var(--fg-muted)]">
        <span className="sm:sr-only">Delivery</span>
        <input inputMode="decimal" aria-label="Delivery (DH)" placeholder={`${courier}`} value={delivery} onChange={(e) => setDelivery(e.target.value)} className={numInput} />
      </label>
      <label className="min-w-0 text-[10px] text-[var(--fg-muted)]">
        <span className="sm:sr-only">Other</span>
        <input inputMode="decimal" aria-label="Other costs (DH)" placeholder="0" value={other} onChange={(e) => setOther(e.target.value)} className={numInput} />
      </label>
      <span className="max-sm:hidden">{r ? <ProfitValue {...r} /> : <span className="block text-right text-xs text-[var(--warning)]">Enter cost</span>}</span>
      <div className="col-span-3 flex justify-end sm:col-span-1">
        {dirty ? (
          <Button size="sm" className="h-8 max-sm:w-full" loading={save.isPending} disabled={invalid} onClick={() => save.mutate()}>
            Save
          </Button>
        ) : null}
      </div>
    </li>
  )
}

/**
 * Admin → Profit → Product costs: every product with what it cost you, the delivery and other
 * costs of one sale, and the profit left — before any order exists.
 */
export function ProductCostSheet() {
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [missing, setMissing] = useState(false)
  const [page, setPage] = useState(1)
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q)
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [q])

  const cats = useQuery({ queryKey: ['categories', 'all'], queryFn: async () => (await categoriesApi.list(true)).data.data, staleTime: 300_000 })
  const sheet = useQuery({
    queryKey: ['admin-profit', 'sheet', search, category, missing, page],
    queryFn: async () => (await adminApi.profit.costSheet({ q: search || undefined, category: category || undefined, missing, page })).data.data,
    placeholderData: (prev) => prev,
  })
  const s = sheet.data
  const courier = s?.courierCosts.delivered ?? 0
  const pages = s ? Math.max(1, Math.ceil(s.total / s.limit)) : 1

  return (
    <div className="space-y-4">
      <Calculator courier={courier} />

      <Panel
        title="Product costs"
        description={
          <>
            What each product cost you and what is left on one sale. Delivery empty = your courier price ({formatCurrency(courier)}). Other = packaging,
            transport… per unit. These are used for the profit of every order.
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-48">
            <SiteIcon name="search" size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
            <input
              type="search"
              placeholder="Search name or SKU"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-9 w-full rounded-full border border-[var(--border)] bg-[var(--bg)] ps-8 pe-3 text-sm outline-none focus:border-[var(--brand)]"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setMissing((m) => !m)
              setPage(1)
            }}
            className={cn(
              'h-9 shrink-0 rounded-full border px-3 text-xs font-medium',
              missing ? 'border-transparent bg-[var(--warning)] text-black' : 'border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]'
            )}
          >
            Without cost {s ? `(${s.missingCount})` : ''}
          </button>
        </div>
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {[{ _id: '', name: 'All' }, ...(cats.data ?? [])].map((c) => (
            <button
              key={c._id}
              type="button"
              onClick={() => {
                setCategory(c._id)
                setPage(1)
              }}
              className={cn(
                'h-8 shrink-0 rounded-full border px-3 text-xs font-medium',
                category === c._id ? 'border-transparent bg-[var(--brand)] text-[var(--brand-fg)]' : 'border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]'
              )}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="hidden grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_6.5rem_7rem_4.5rem] gap-x-2 border-b border-[var(--border)] pb-1.5 text-[11px] text-[var(--fg-muted)] sm:grid">
          <span>Product</span>
          <span className="text-right">Bought for</span>
          <span className="text-right">Delivery</span>
          <span className="text-right">Other</span>
          <span className="text-right">You keep / sale</span>
          <span />
        </div>
        {!s ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : s.items.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--fg-muted)]">{missing ? 'Every product has a cost price.' : 'No products found.'}</p>
        ) : (
          <ul className={cn('divide-y divide-[var(--border)]', sheet.isFetching && 'opacity-60')}>
            {s.items.map((row) => (
              <CostRow key={row.productId} row={row} courier={courier} />
            ))}
          </ul>
        )}
        {pages > 1 ? (
          <div className="flex items-center justify-between gap-2 text-sm">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-[var(--fg-muted)]">
              Page {page} of {pages}
            </span>
            <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        ) : null}
      </Panel>
    </div>
  )
}
