import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { CustomerFilters } from '@/components/admin/customers/CustomerFilters'
import { CustomerTable } from '@/components/admin/customers/CustomerTable'
import { CalculationNote, PeriodFilter, ProfitText, StatCard } from '@/components/admin/customers/shared'
import {
  FILTER_KEYS,
  SEGMENT_LABELS,
  chipClass,
  money,
  type FilterValues,
  type Period,
} from '@/components/admin/customers/utils'
import { toast } from '@/store/toastStore'
import { cn } from '@/lib/cn'
import type { CustomerListParams, CustomerRow, SavedSegment, SegmentKey, SummaryBlock } from '@/types'

type SortKey = NonNullable<CustomerListParams['sort']>

const SORTS: { value: SortKey; label: string; profit?: boolean }[] = [
  { value: 'registered', label: 'Last registered' },
  { value: 'spent', label: 'Total spent' },
  { value: 'net', label: 'Net sales' },
  { value: 'profit', label: 'Gross profit', profit: true },
  { value: 'orders', label: 'Completed orders' },
  { value: 'lastOrder', label: 'Last purchase' },
  { value: 'name', label: 'Name' },
]

const BUILTIN_SEGMENTS: SegmentKey[] = [
  'new',
  'repeat',
  'high-spend',
  'high-profit',
  'inactive',
  'wholesale',
  'wholesale-pending',
  'outstanding',
]

const PAGE_SIZE = 20

export function Customers() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const get = (k: string) => params.get(k) || ''

  const page = Math.max(Number(params.get('page') || 1), 1)
  const period: Period = { from: get('from'), to: get('to') }
  const segment = get('segment')
  const sort = (get('sort') || 'registered') as SortKey
  const dir = (get('dir') || 'desc') as 'asc' | 'desc'
  const q = get('q')
  const filters = useMemo(
    () => Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || ''])) as FilterValues,
    [params]
  )

  const [search, setSearch] = useState(q)
  const [toggleRow, setToggleRow] = useState<CustomerRow | null>(null)

  const update = (patch: Record<string, string | undefined>) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        Object.entries(patch).forEach(([k, v]) => {
          if (!v) next.delete(k)
          else next.set(k, v)
        })
        if (!('page' in patch)) next.delete('page')
        return next
      },
      { replace: true }
    )
  }

  // Debounce the search box into the URL.
  useEffect(() => {
    const value = search.trim()
    if (value === q) return
    const t = window.setTimeout(() => update({ q: value || undefined }), 350)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to typing
  }, [search])

  const listParams: CustomerListParams = {
    page,
    limit: PAGE_SIZE,
    q: q || undefined,
    from: period.from || undefined,
    to: period.to || undefined,
    segment: segment || undefined,
    sort,
    dir,
    type: (filters.type || undefined) as CustomerListParams['type'],
    status: (filters.status || undefined) as CustomerListParams['status'],
    activity: (filters.activity || undefined) as CustomerListParams['activity'],
    registeredFrom: filters.registeredFrom || undefined,
    registeredTo: filters.registeredTo || undefined,
    minNet: filters.minNet || undefined,
    maxNet: filters.maxNet || undefined,
    minOrders: filters.minOrders || undefined,
    maxOrders: filters.maxOrders || undefined,
    minProfit: filters.minProfit || undefined,
  }

  const summary = useQuery({
    queryKey: ['admin-customer-summary', { from: period.from, to: period.to }],
    queryFn: async () =>
      (
        await adminApi.customers.summary({
          from: period.from || undefined,
          to: period.to || undefined,
        })
      ).data.data,
    placeholderData: keepPreviousData,
  })

  const customers = useQuery({
    queryKey: ['admin-customers', listParams],
    queryFn: async () => {
      const res = await adminApi.customers.list(listParams)
      return { items: res.data.data, meta: res.data.meta }
    },
    placeholderData: keepPreviousData,
  })

  const profitVisible = summary.data?.lifetime.profitVisible ?? false
  const segmentSettings = summary.data?.segmentSettings
  const saved = segmentSettings?.saved ?? []

  const toggle = useMutation({
    mutationFn: (row: CustomerRow) => adminApi.customers.setActive(row._id, row.status === 'disabled'),
    onSuccess: (_res, row) => {
      qc.invalidateQueries({ queryKey: ['admin-customers'] })
      qc.invalidateQueries({ queryKey: ['admin-customer-summary'] })
      qc.invalidateQueries({ queryKey: ['admin-customer', row._id] })
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
      toast.success(row.status === 'disabled' ? 'Customer enabled' : 'Customer disabled')
      setToggleRow(null)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const saveSegments = useMutation({
    mutationFn: async (next: SavedSegment[]) => {
      if (!segmentSettings) throw new Error('Segment settings are not loaded yet')
      return adminApi.settings.update({ customerSegments: { ...segmentSettings, saved: next } })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-customer-summary'] })
      qc.invalidateQueries({ queryKey: ['admin-settings'] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const currentFilterObject = () => {
    const out: Record<string, string | number> = {}
    for (const k of FILTER_KEYS) {
      const v = filters[k]
      if (!v) continue
      const n = Number(v)
      out[k] = /^(min|max)/.test(k) && Number.isFinite(n) ? n : v
    }
    return out
  }

  const onSaveSegment = (name: string) => {
    const filterObj = currentFilterObject()
    if (!Object.keys(filterObj).length) {
      toast.error('Set at least one filter before saving a segment')
      return
    }
    if (saved.length >= 20) {
      toast.error('You can save up to 20 segments')
      return
    }
    const id = `seg-${Date.now().toString(36)}`
    saveSegments.mutate([...saved, { id, name, filters: filterObj }], {
      onSuccess: () => {
        toast.success(`Segment "${name}" saved`)
        update({ segment: id })
      },
    })
  }

  const removeSegment = (s: SavedSegment) => {
    saveSegments.mutate(
      saved.filter((x) => x.id !== s.id),
      {
        onSuccess: () => {
          toast.success(`Segment "${s.name}" removed`)
          if (segment === s.id) update({ segment: undefined })
        },
      }
    )
  }

  /** Selecting a saved segment loads its filters into the panel as well. */
  const selectSaved = (s: SavedSegment) => {
    const patch: Record<string, string | undefined> = { segment: s.id }
    for (const k of FILTER_KEYS) {
      const v = s.filters[k]
      patch[k] = v === undefined || v === '' ? undefined : String(v)
    }
    update(patch)
  }

  const clearFilters = () => {
    const patch: Record<string, undefined> = { segment: undefined }
    for (const k of FILTER_KEYS) patch[k] = undefined
    update(patch)
  }

  const exportCsv = useMutation({
    mutationFn: async () => {
      const rest: CustomerListParams = { ...listParams, page: undefined, limit: undefined }
      return (await adminApi.customers.exportCsv(rest)).data
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const s = summary.data
  const hasPeriod = Boolean(period.from || period.to)
  const block: SummaryBlock | undefined = hasPeriod ? (s?.period ?? undefined) : s?.lifetime
  const lifetimeHint = (render: (b: SummaryBlock) => ReactNode) =>
    hasPeriod && s ? <>All time: {render(s.lifetime)}</> : null

  const segmentChips: { id: string; label: string; saved?: SavedSegment }[] = [
    { id: '', label: 'All' },
    ...BUILTIN_SEGMENTS.filter((k) => k !== 'high-profit' || profitVisible).map((k) => ({
      id: k,
      label: SEGMENT_LABELS[k],
    })),
    ...saved.map((sv) => ({ id: sv.id, label: sv.name, saved: sv })),
  ]

  const items = customers.data?.items ?? []
  const total = customers.data?.meta?.total

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <AdminHeader
        title="Customers"
        description="Accounts, spending, profitability and wholesale status."
        actions={
          <Button variant="outline" size="sm" loading={exportCsv.isPending} onClick={() => exportCsv.mutate()}>
            <SiteIcon name="arrow-up" size={14} className="rotate-180" /> Export CSV
          </Button>
        }
      />

      <PeriodFilter value={period} onChange={(p) => update({ from: p.from || undefined, to: p.to || undefined })} />

      {/* Summary cards */}
      {summary.isError ? (
        <QueryErrorState title="Could not load the summary" onRetry={() => summary.refetch()} />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          <StatCard label="Customers" value={s ? s.counts.total : '—'} hint={hasPeriod && s?.counts.newInPeriod != null ? `+${s.counts.newInPeriod} new` : undefined} />
          <StatCard label="Active" value={s ? s.counts.active : '—'} />
          <StatCard label="Retail" value={s ? s.counts.retail : '—'} />
          <StatCard
            label="Wholesale"
            value={s ? s.counts.wholesaleApproved : '—'}
            onClick={() => update({ segment: 'wholesale' })}
            active={segment === 'wholesale'}
          />
          <StatCard
            label="Applications"
            value={s ? s.counts.wholesalePending : '—'}
            onClick={() => update({ segment: 'wholesale-pending' })}
            active={segment === 'wholesale-pending'}
          />
          <StatCard
            label="Net sales"
            value={block ? money(block.netSales) : '—'}
            hint={lifetimeHint((b) => money(b.netSales))}
          />
          {profitVisible ? (
            <StatCard
              label="Gross profit"
              value={
                block ? (
                  <ProfitText value={block.grossProfit} missing={block.ordersMissingCost} className="font-display" />
                ) : (
                  '—'
                )
              }
              hint={lifetimeHint((b) => (
                <ProfitText value={b.grossProfit} missing={b.ordersMissingCost} className="text-[11px]" />
              ))}
            />
          ) : null}
          <StatCard
            label="Avg. order"
            value={block ? money(block.averageOrderValue) : '—'}
            hint={lifetimeHint((b) => money(b.averageOrderValue))}
          />
        </div>
      )}

      {/* Segment chips */}
      <div
        className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label="Customer segments"
      >
        {segmentChips.map((c) =>
          c.saved ? (
            <span key={c.id} className={cn(chipClass(segment === c.id), 'inline-flex items-center gap-1 pr-1')}>
              <button type="button" aria-pressed={segment === c.id} onClick={() => selectSaved(c.saved!)}>
                {c.label}
              </button>
              <button
                type="button"
                className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-[var(--bg-muted)]"
                aria-label={`Remove saved segment ${c.label}`}
                disabled={saveSegments.isPending}
                onClick={() => removeSegment(c.saved!)}
              >
                <SiteIcon name="close" size={12} />
              </button>
            </span>
          ) : (
            <button
              key={c.id || 'all'}
              type="button"
              aria-pressed={segment === c.id}
              className={chipClass(segment === c.id)}
              onClick={() => update({ segment: c.id || undefined })}
            >
              {c.label}
            </button>
          )
        )}
      </div>

      {/* Search + sort */}
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Input
            type="search"
            aria-label="Search customers"
            placeholder="Search name, email, phone, company or ID (C-1A2B3C)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex min-w-0 gap-2">
          <label className="min-w-0 flex-1 sm:w-48 sm:flex-none">
            <span className="sr-only">Sort by</span>
            <select
              className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3 text-sm text-[var(--fg)] outline-none ring-brand"
              value={sort}
              onChange={(e) => update({ sort: e.target.value === 'registered' ? undefined : e.target.value })}
            >
              {SORTS.filter((o) => !o.profit || profitVisible).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="outline"
            className="h-11 shrink-0"
            aria-label={dir === 'desc' ? 'Sorted descending, switch to ascending' : 'Sorted ascending, switch to descending'}
            onClick={() => update({ dir: dir === 'desc' ? 'asc' : undefined })}
          >
            <SiteIcon name="arrow-up" size={14} className={cn('transition', dir === 'desc' && 'rotate-180')} />
            {dir === 'desc' ? 'Desc' : 'Asc'}
          </Button>
        </div>
      </div>

      <CustomerFilters
        values={filters}
        onChange={(patch) =>
          // Editing filters detaches a saved segment (its stored filters would override the edit).
          update(saved.some((x) => x.id === segment) ? { ...patch, segment: undefined } : patch)
        }
        onClear={clearFilters}
        onSave={onSaveSegment}
        saving={saveSegments.isPending}
        profitVisible={profitVisible}
      />

      {customers.isPending && !customers.data ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : customers.isError ? (
        <QueryErrorState onRetry={() => customers.refetch()} />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-[var(--fg-muted)]" aria-live="polite">
            {total !== undefined ? `${total} customer${total === 1 ? '' : 's'}` : ''}
            {hasPeriod ? ' · metrics for the selected period' : ' · lifetime metrics'}
            {customers.isFetching ? ' · updating…' : ''}
          </p>
          <CustomerTable
            rows={items}
            profitVisible={profitVisible}
            onToggle={(row) => setToggleRow(row)}
            togglingId={toggle.isPending ? (toggle.variables?._id ?? null) : null}
          />
          <Pagination
            page={page}
            pages={customers.data?.meta?.pages || 1}
            onChange={(p) => update({ page: p > 1 ? String(p) : undefined })}
          />
        </div>
      )}

      <CalculationNote />

      <ConfirmDialog
        open={Boolean(toggleRow)}
        title={toggleRow?.status === 'disabled' ? 'Enable this customer?' : 'Disable this customer?'}
        description={
          toggleRow?.status === 'disabled'
            ? `${toggleRow?.name} will be able to sign in and order again.`
            : `${toggleRow?.name ?? 'This customer'} will be signed out and unable to sign in. Orders are not affected.`
        }
        confirmLabel={toggleRow?.status === 'disabled' ? 'Enable' : 'Disable'}
        loading={toggle.isPending}
        onClose={() => setToggleRow(null)}
        onConfirm={() => {
          if (toggleRow) toggle.mutate(toggleRow)
        }}
      />
    </div>
  )
}
