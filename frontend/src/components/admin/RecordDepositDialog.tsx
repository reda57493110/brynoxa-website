import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { OrderDepositPanel } from '@/components/admin/OrderDepositPanel'
import { formatCurrency, formatDate } from '@/lib/format'
import { orderStatusLabel } from '@/lib/orderStatus'
import { cn } from '@/lib/cn'
import type { CustomerProfileOrder } from '@/types'

type Picked = { id: string; name: string; email?: string }

const OPEN = ['pending', 'no_answer']

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold',
            done ? 'bg-[var(--brand)] text-[var(--brand-fg)]' : 'bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand-text)]'
          )}
        >
          {done ? <SiteIcon name="check" size={12} /> : n}
        </span>
        {title}
      </p>
      {children}
    </div>
  )
}

function CustomerPicker({ onPick }: { onPick: (c: Picked) => void }) {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 250)
    return () => clearTimeout(id)
  }, [q])
  const list = useQuery({
    queryKey: ['admin-customers-pick', debounced],
    queryFn: async () => (await adminApi.customers.list({ q: debounced || undefined, limit: 8 })).data.data,
  })
  return (
    <div>
      <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, phone or customer ID" aria-label="Search customers" />
      <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-[var(--border)]">
        {list.isLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : !list.data?.length ? (
          <p className="px-3 py-4 text-sm text-[var(--fg-muted)]">No customer found.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {list.data.map((c) => (
              <li key={c._id}>
                <button
                  type="button"
                  onClick={() => onPick({ id: c._id, name: c.name, email: c.email })}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-start transition hover:bg-[var(--bg-muted)]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-muted)] text-xs font-semibold uppercase">
                    {c.name.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.name}</span>
                    <span className="block truncate text-xs text-[var(--fg-muted)]">
                      {c.email}
                      {c.phone ? ` · ${c.phone}` : ''}
                    </span>
                  </span>
                  {c.metrics.orders.open ? <Badge variant="warning">{c.metrics.orders.open} open</Badge> : null}
                  <SiteIcon name="chevron-right" size={14} className="shrink-0 text-[var(--fg-muted)] rtl:rotate-180" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function OrderPicker({ customerId, onPick }: { customerId: string; onPick: (o: CustomerProfileOrder) => void }) {
  const profile = useQuery({
    queryKey: ['admin-customer-orders-pick', customerId],
    queryFn: async () => (await adminApi.customers.profile(customerId)).data.data,
  })
  const orders = [...(profile.data?.orders ?? [])].sort((a, b) => {
    const rank = (o: CustomerProfileOrder) => (OPEN.includes(o.orderStatus) ? 0 : o.deposit ? 1 : 2)
    return rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt)
  })
  if (profile.isLoading) return <div className="flex justify-center py-6"><Spinner /></div>
  if (!orders.length) return <p className="rounded-xl border border-[var(--border)] px-3 py-4 text-sm text-[var(--fg-muted)]">This customer has no orders.</p>
  return (
    <ul className="max-h-72 divide-y divide-[var(--border)] overflow-y-auto rounded-xl border border-[var(--border)]">
      {orders.map((o) => {
        const open = OPEN.includes(o.orderStatus)
        return (
          <li key={o._id}>
            <button
              type="button"
              onClick={() => onPick(o)}
              disabled={!open && !o.deposit}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-start transition hover:bg-[var(--bg-muted)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">#{o.orderNumber}</span>
                <span className="block text-xs text-[var(--fg-muted)]">
                  {formatDate(o.createdAt)} · {o.items} item{o.items === 1 ? '' : 's'} · {orderStatusLabel(o.orderStatus)}
                </span>
              </span>
              {o.deposit ? (
                <Badge variant={o.deposit.status === 'received' ? 'success' : 'warning'}>
                  {formatCurrency(o.deposit.amount)} {o.deposit.status === 'received' ? 'paid' : 'due'}
                </Badge>
              ) : open ? (
                <Badge variant="muted">No deposit yet</Badge>
              ) : null}
              <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(o.total)}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Admin: record a deposit a customer sent (bank, Cash Plus…) — pick the customer, then their order,
 * then set the amount, add the proof photo and mark it received. The customer sees it on their order.
 */
export function RecordDepositDialog({
  open,
  onClose,
  customer,
}: {
  open: boolean
  onClose: () => void
  /** Start with this customer already chosen (from their profile) */
  customer?: Picked
}) {
  const [picked, setPicked] = useState<Picked | null>(customer ?? null)
  const [orderId, setOrderId] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setPicked(customer ?? null)
      setOrderId(null)
    }
  }, [open, customer])

  const order = useQuery({
    queryKey: ['admin-order', orderId],
    queryFn: async () => (await adminApi.orders.get(orderId!)).data.data,
    enabled: Boolean(orderId),
  })

  return (
    <Modal open={open} onClose={onClose} title="Record a deposit" size="lg">
      <div className="space-y-5">
        <Step n={1} title="Customer" done={Boolean(picked)}>
          {picked ? (
            <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{picked.name}</span>
                {picked.email ? <span className="block truncate text-xs text-[var(--fg-muted)]">{picked.email}</span> : null}
              </span>
              <button
                type="button"
                onClick={() => {
                  setPicked(null)
                  setOrderId(null)
                }}
                className="text-xs font-medium text-[var(--brand-text)] hover:underline"
              >
                Change
              </button>
            </div>
          ) : (
            <CustomerPicker onPick={setPicked} />
          )}
        </Step>

        {picked ? (
          <Step n={2} title="Order" done={Boolean(orderId)}>
            {orderId && order.data ? (
              <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">#{order.data.orderNumber}</span>
                  <span className="block text-xs text-[var(--fg-muted)]">
                    {orderStatusLabel(order.data.orderStatus)} · {formatCurrency(order.data.pricing.total)}
                  </span>
                </span>
                <Link to={`/admin/orders/${order.data._id}`} onClick={onClose} className="text-xs font-medium text-[var(--brand-text)] hover:underline">
                  Open order
                </Link>
                <button type="button" onClick={() => setOrderId(null)} className="text-xs font-medium text-[var(--brand-text)] hover:underline">
                  Change
                </button>
              </div>
            ) : orderId ? (
              <div className="flex justify-center py-6"><Spinner /></div>
            ) : (
              <>
                <OrderPicker customerId={picked.id} onPick={(o) => setOrderId(o._id)} />
                <p className="mt-1.5 text-[11px] text-[var(--fg-muted)]">
                  Pending orders first. Closed orders without a deposit can't take one.
                </p>
              </>
            )}
          </Step>
        ) : null}

        {orderId && order.data ? (
          <Step n={3} title="Amount, proof photo and confirmation">
            <OrderDepositPanel order={order.data} />
          </Step>
        ) : null}
      </div>
    </Modal>
  )
}
