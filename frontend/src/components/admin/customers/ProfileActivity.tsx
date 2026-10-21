import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { Badge } from '@/components/ui/Badge'
import { SafeImage } from '@/components/ui/SafeImage'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import { optimizedImageUrl } from '@/lib/image'
import { orderStatusLabel, orderStatusVariant } from '@/lib/orderStatus'
import { cn } from '@/lib/cn'
import type { CustomerProfile, CustomerProfileOrder } from '@/types'
import { Section } from './shared'

type Step = NonNullable<CustomerProfileOrder['history']>[number]

function accountIcon(type: string): SiteIconName {
  if (type === 'registered') return 'user'
  if (type.includes('wholesale')) return 'tag'
  if (type.includes('email')) return 'mail'
  if (type.includes('note')) return 'pencil'
  if (type.includes('disable') || type.includes('enable') || type.includes('status')) return 'shield'
  return 'clock'
}

function stepIcon(s: Step): SiteIconName {
  if (s.kind === 'payment') return 'banknote'
  if (s.kind === 'refund') return 'refresh'
  switch (s.status) {
    case 'pending':
      return 'cart'
    case 'confirmed':
      return 'check'
    case 'shipped':
    case 'rescheduled':
      return 'truck'
    case 'delivered':
      return 'package-check'
    case 'cancelled':
    case 'delivery_failed':
      return 'close'
    case 'no_answer':
      return 'phone'
    default:
      return 'package-open'
  }
}

function stepTitle(s: Step, first: boolean) {
  if (s.kind === 'payment') return `Deposit received · ${formatCurrency(s.amount ?? 0)}`
  if (s.kind === 'refund') return `Refund · ${formatCurrency(s.amount ?? 0)}`
  if (first && s.status === 'pending') return 'Order placed'
  return orderStatusLabel(s.status ?? '')
}

const stepTone = (s: Step) =>
  s.kind === 'refund' || s.status === 'cancelled' || s.status === 'delivery_failed'
    ? 'text-[var(--danger)]'
    : s.kind === 'payment' || s.status === 'delivered'
      ? 'text-[var(--success)]'
      : 'text-[var(--brand-text)]'

function Steps({ history }: { history: Step[] }) {
  return (
    <ol className="relative space-y-3 border-s border-[var(--border)] ps-5">
      {history.map((s, i) => (
        <li key={`${s.at}-${i}`} className="relative min-w-0">
          <span
            className={cn(
              'absolute -start-[1.95rem] top-0 grid size-6 place-items-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)]',
              stepTone(s)
            )}
          >
            <SiteIcon name={stepIcon(s)} size={12} />
          </span>
          <p className="text-sm font-medium">
            {stepTitle(s, i === 0)}
            {s.internal ? <span className="ms-1.5 text-[10px] font-normal text-[var(--fg-muted)]">(staff only)</span> : null}
          </p>
          {s.note ? <p className="text-xs break-words text-[var(--fg-muted)]">{s.note}</p> : null}
          {s.staffNote ? <p className="text-xs break-words text-[var(--fg-muted)]">Staff note: {s.staffNote}</p> : null}
          <p className="text-[11px] text-[var(--fg-muted)]">
            <time dateTime={s.at}>{formatDateTime(s.at)}</time>
            {s.by ? ` · by ${s.by}` : ''}
          </p>
        </li>
      ))}
    </ol>
  )
}

function Bought({ order }: { order: CustomerProfileOrder }) {
  const lines = order.lines ?? []
  return (
    <ul className="divide-y divide-[var(--border)]">
      {lines.map((l, i) => (
        <li key={`${l.productId}-${i}`} className="flex items-center gap-2.5 py-2">
          <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-muted)]">
            {l.image ? <SafeImage src={optimizedImageUrl(l.image, 96)} alt="" className="size-full object-cover" /> : null}
          </span>
          <div className="min-w-0 flex-1">
            <Link to={`/admin/products/${l.productId}/edit`} className="line-clamp-2 text-sm font-medium hover:text-[var(--brand-text)]">
              {l.name}
            </Link>
            <p className="text-[11px] text-[var(--fg-muted)]">
              {l.qty} × {formatCurrency(l.price)}
              {l.returnedQty ? <span className="text-[var(--danger)]"> · {l.returnedQty} returned</span> : null}
            </p>
          </div>
          <span className="shrink-0 text-sm font-medium tabular-nums">{formatCurrency(l.qty * l.price)}</span>
        </li>
      ))}
      <li className="flex justify-between pt-2 text-sm">
        <span className="text-[var(--fg-muted)]">Order total</span>
        <span className="font-semibold tabular-nums">{formatCurrency(order.total)}</span>
      </li>
    </ul>
  )
}

function OrderCard({ order, open, onToggle }: { order: CustomerProfileOrder; open: boolean; onToggle: () => void }) {
  const lines = order.lines ?? []
  const first = lines[0]
  return (
    <li className="overflow-hidden rounded-xl border border-[var(--border)]">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={cn('flex w-full items-center gap-3 px-3 py-2.5 text-start transition hover:bg-[var(--bg-muted)] sm:px-4', open && 'bg-[var(--bg-muted)]')}
      >
        <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-muted)]">
          {first?.image ? <SafeImage src={optimizedImageUrl(first.image, 96)} alt="" className="size-full object-cover" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold">#{order.orderNumber}</span>
            <Badge variant={orderStatusVariant(order.orderStatus)}>{orderStatusLabel(order.orderStatus)}</Badge>
          </span>
          <span className="mt-0.5 block truncate text-xs text-[var(--fg-muted)]">
            {formatDate(order.createdAt)} · {order.items} item{order.items === 1 ? '' : 's'}
            {first ? ` · ${first.name}${lines.length > 1 ? ` +${lines.length - 1}` : ''}` : ''}
          </span>
        </span>
        <span className="shrink-0 text-end">
          <span className="block text-sm font-semibold tabular-nums">{formatCurrency(order.total)}</span>
          <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-[var(--brand-text)]">
            {open ? 'Hide' : 'See what happened'}
            <SiteIcon name="chevron-down" size={12} className={cn('transition', open && 'rotate-180')} />
          </span>
        </span>
      </button>
      {open ? (
        <div className="grid gap-4 border-t border-[var(--border)] p-3 sm:p-4 md:grid-cols-2">
          <div className="min-w-0">
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-[var(--fg-muted)] uppercase">What happened</h3>
            <Steps history={order.history ?? []} />
          </div>
          <div className="min-w-0">
            <h3 className="mb-1 text-xs font-semibold tracking-wide text-[var(--fg-muted)] uppercase">What they bought</h3>
            <Bought order={order} />
            <Link to={`/admin/orders/${order._id}`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-text)] hover:underline">
              Open the order <SiteIcon name="arrow-right" size={13} />
            </Link>
          </div>
        </div>
      ) : null}
    </li>
  )
}

/** Customer → Activity: one card per order (steps + products on click), then account events. */
export function ProfileActivity({ profile }: { profile: CustomerProfile }) {
  const orders = profile.orders
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(orders[0] ? [orders[0]._id] : []))
  const [showAccount, setShowAccount] = useState(false)
  const allOpen = orders.length > 0 && orders.every((o) => openIds.has(o._id))
  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const account = profile.timeline.filter((e) => !e.orderId)
  const units = orders.reduce((a, o) => a + (o.orderStatus === 'cancelled' ? 0 : o.items), 0)

  return (
    <div className="space-y-4">
      <Section
        title={`Orders (${orders.length})`}
        actions={
          orders.length > 1 ? (
            <button
              type="button"
              onClick={() => setOpenIds(allOpen ? new Set() : new Set(orders.map((o) => o._id)))}
              className="text-sm font-medium text-[var(--brand-text)] hover:underline"
            >
              {allOpen ? 'Close all' : 'Open all'}
            </button>
          ) : null
        }
      >
        {orders.length ? (
          <>
            <p className="-mt-1 mb-3 text-xs text-[var(--fg-muted)]">
              {units} item{units === 1 ? '' : 's'} ordered · first order {formatDate(orders[orders.length - 1].createdAt)} · click an order to see every step
            </p>
            <ul className="space-y-2">
              {orders.map((o) => (
                <OrderCard key={o._id} order={o} open={openIds.has(o._id)} onToggle={() => toggle(o._id)} />
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-[var(--fg-muted)]">No orders yet.</p>
        )}
      </Section>

      <Section
        title="Account"
        actions={
          account.length > 4 ? (
            <button type="button" onClick={() => setShowAccount((v) => !v)} className="text-sm font-medium text-[var(--brand-text)] hover:underline">
              {showAccount ? 'Show less' : `Show all ${account.length}`}
            </button>
          ) : null
        }
      >
        {account.length ? (
          <ul className="divide-y divide-[var(--border)]">
            {(showAccount ? account : account.slice(0, 4)).map((e, i) => (
              <li key={`${e.at}-${i}`} className="flex items-start gap-3 py-2">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-[var(--bg-muted)] text-[var(--brand-text)]">
                  <SiteIcon name={accountIcon(e.type)} size={13} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium break-words">{e.title}</p>
                  {e.detail ? <p className="text-xs break-words text-[var(--fg-muted)]">{e.detail}</p> : null}
                </div>
                <time dateTime={e.at} className="shrink-0 text-[11px] text-[var(--fg-muted)]">
                  {formatDate(e.at)}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--fg-muted)]">Nothing yet.</p>
        )}
      </Section>
    </div>
  )
}
