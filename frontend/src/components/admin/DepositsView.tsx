import { useDeferredValue, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { RecordDepositFlow } from '@/components/admin/RecordDepositDialog'
import { OrdersSettings } from '@/components/admin/settings/StoreSettings'
import { formatCurrency, formatDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/store/authStore'
import { hasPermission } from '@/lib/permissions'
import type { Order } from '@/types'
import { useAdminT } from '@/store/adminLangStore'
import type { AdminKey } from '@/i18n/admin'

/** Orders | Deposits & payments, at the top of Admin → Orders. */
export function OrdersTabs() {
  const tr = useAdminT()
  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'deposits' ? 'deposits' : 'orders'
  const tab = (active: boolean) =>
    cn(
      'inline-flex h-9 items-center gap-1.5 border-b-2 px-1 text-sm font-medium transition',
      active ? 'border-[var(--brand)] text-[var(--fg)]' : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]'
    )
  return (
    <div className="flex gap-5 border-b border-[var(--border)]" role="tablist" aria-label={tr('orders.tabsAria')}>
      <button type="button" role="tab" aria-selected={view === 'orders'} className={tab(view === 'orders')} onClick={() => setParams({})}>
        <SiteIcon name="cart" size={14} /> {tr('common.orders')}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === 'deposits'}
        className={tab(view === 'deposits')}
        onClick={() => setParams({ view: 'deposits' })}
      >
        <SiteIcon name="banknote" size={14} /> {tr('orders.tabDeposits')}
      </button>
    </div>
  )
}

type DepositFilter = 'reported' | 'due' | 'paid' | 'any'
// Labels are text keys, translated when shown
const FILTERS: { id: DepositFilter; label: AdminKey }[] = [
  { id: 'reported', label: 'orders.dep.toCheck' },
  { id: 'due', label: 'orders.dep.due' },
  { id: 'paid', label: 'pay.paid' },
  { id: 'any', label: 'orders.all' },
]

function DepositBadge({ o }: { o: Order }) {
  const tr = useAdminT()
  const d = o.deposit
  if (!d) return null
  if (d.status === 'received') return <Badge variant="success">{tr('pay.paid')}</Badge>
  if (d.payment) return <Badge variant="brand">{tr('orders.dep.toCheck')}</Badge>
  return <Badge variant="warning">{tr('orders.dep.due')}</Badge>
}

function Card({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 sm:rounded-2xl sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold sm:text-base">{title}</h2>
        {aside ? <div className="ms-auto">{aside}</div> : null}
      </div>
      {children}
    </section>
  )
}

/** Every order with a deposit: due, sent by the customer (to check), or paid. */
function DepositsList() {
  const tr = useAdminT()
  const [filter, setFilter] = useState<DepositFilter>('reported')
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query.trim())
  const list = useQuery({
    queryKey: ['admin-orders', 'deposits', filter, q],
    queryFn: async () => (await adminApi.orders.list({ deposit: filter, q: q || undefined, limit: 50 })).data.data,
    placeholderData: keepPreviousData,
  })
  const orders = list.data ?? []

  return (
    <Card title={tr('orders.dep.title')} aside={list.isFetching ? <Spinner size="sm" /> : null}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                'h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition',
                filter === f.id
                  ? 'border-transparent bg-[var(--brand)] text-[var(--brand-fg)]'
                  : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--brand)] hover:text-[var(--fg)]'
              )}
            >
              {tr(f.label)}
            </button>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <SiteIcon name="search" size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tr('orders.dep.search')}
            className="h-9 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-input)] ps-8 pe-3 text-sm outline-none ring-brand"
          />
        </div>
      </div>

      {list.isLoading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : orders.length ? (
        <ul className="mt-3 divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
          {orders.map((o) => {
            const p = o.deposit?.payment
            return (
              <li key={o._id}>
                <Link to={`/admin/orders/${o._id}`} className="flex min-w-0 items-center gap-3 px-3 py-2.5 transition hover:bg-[var(--bg-muted)]">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 text-sm">
                      <span className="font-medium">{o.shippingAddress?.fullName || '—'}</span>
                      <span className="text-xs text-[var(--fg-muted)]"><bdi dir="ltr">#{o.orderNumber}</bdi></span>
                    </span>
                    <span className="block truncate text-[11px] text-[var(--fg-muted)]">
                      {p
                        ? [p.methodName, p.payerName ? tr('orders.dep.paidBy', { name: p.payerName }) : '', p.reference ? tr('orders.dep.ref', { ref: p.reference }) : '']
                            .filter(Boolean)
                            .join(' · ')
                        : `${o.shippingAddress?.phone || ''} · ${formatDate(o.createdAt)}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-end">
                    <span className="block text-sm font-semibold tabular-nums">{formatCurrency(o.deposit?.amount ?? 0)}</span>
                    <DepositBadge o={o} />
                  </span>
                  <SiteIcon name="chevron-right" size={14} className="shrink-0 text-[var(--fg-muted)] rtl:rotate-180" />
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-[var(--fg-muted)]">
          {filter === 'reported' ? tr('orders.dep.nothingToCheck') : filter === 'due' ? tr('orders.dep.noneWaiting') : tr('orders.dep.noneFound')}
        </p>
      )}
    </Card>
  )
}

/** Admin → Orders → Deposits & payments */
export function DepositsView() {
  const tr = useAdminT()
  // Payment options are set once: folded away unless a link points to them
  const [showOptions, setShowOptions] = useState(() => typeof window !== 'undefined' && window.location.hash === '#payment-options')
  // Where customers send money is changed by the owner only (order staff use these options)
  const canEditOptions = hasPermission(useAuthStore((s) => s.user?.role), 'settings')
  return (
    <div className="min-w-0 space-y-3 sm:space-y-4">
      <h1 className="font-display text-lg font-semibold tracking-tight sm:text-xl">{tr('common.orders')}</h1>
      <OrdersTabs />

      <div className="grid min-w-0 gap-3 sm:gap-4 xl:grid-cols-2">
        <Card title={tr('orders.dep.request')}>
          <RecordDepositFlow />
        </Card>
        <DepositsList />
      </div>

      <div id="payment-options" className="scroll-mt-20">
        {!canEditOptions ? null : showOptions ? (
          <>
            <div className="mb-2 flex justify-end">
              <button type="button" onClick={() => setShowOptions(false)} className="text-xs font-medium text-[var(--fg-muted)] hover:text-[var(--fg)]">
                {tr('orders.dep.hideOptions')}
              </button>
            </div>
            <OrdersSettings />
          </>
        ) : (
          <button
            type="button"
            onClick={() => setShowOptions(true)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-3 text-start hover:border-[var(--brand)] sm:rounded-2xl sm:px-5"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{tr('orders.dep.options')}</span>
              <span className="block text-xs text-[var(--fg-muted)]">{tr('orders.dep.optionsHint')}</span>
            </span>
            <span className="shrink-0 text-xs font-medium text-[var(--brand-text)]">{tr('orders.dep.show')}</span>
          </button>
        )}
      </div>
    </div>
  )
}
