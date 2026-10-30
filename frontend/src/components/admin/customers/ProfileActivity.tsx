import { useState } from 'react'
import { StaffLink } from '@/components/admin/StaffLink'
import { Link } from 'react-router-dom'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
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
            <StaffLink
              to={`/admin/products/${l.productId}/edit`}
              className="line-clamp-2 text-sm font-medium hover:text-[var(--brand-text)]"
              fallbackClassName="line-clamp-2 text-sm font-medium"
            >
              {l.name}
            </StaffLink>
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

/** One line per order: number, date, status, total. Click opens the details. */
function OrderLine({ order, onOpen }: { order: CustomerProfileOrder; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-1 py-2.5 text-start transition hover:bg-[var(--bg-muted)] sm:px-2">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">#{order.orderNumber}</span>
          <span className="block text-xs text-[var(--fg-muted)]">{formatDate(order.createdAt)}</span>
        </span>
        <Badge variant={orderStatusVariant(order.orderStatus)}>{orderStatusLabel(order.orderStatus)}</Badge>
        <span className="w-24 shrink-0 text-end text-sm font-medium tabular-nums">{formatCurrency(order.total)}</span>
        <SiteIcon name="chevron-right" size={14} className="shrink-0 text-[var(--fg-muted)] rtl:rotate-180" />
      </button>
    </li>
  )
}

function OrderDetails({ order }: { order: CustomerProfileOrder }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-[var(--fg-muted)]">Placed {formatDateTime(order.createdAt)}</span>
        <Badge variant={orderStatusVariant(order.orderStatus)}>{orderStatusLabel(order.orderStatus)}</Badge>
      </div>
      <div>
        <h3 className="mb-1 text-xs font-semibold tracking-wide text-[var(--fg-muted)] uppercase">What they bought</h3>
        <Bought order={order} />
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-[var(--fg-muted)] uppercase">What happened</h3>
        <Steps history={order.history ?? []} />
      </div>
      <Link to={`/admin/orders/${order._id}`} className="inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-text)] hover:underline">
        Open the order <SiteIcon name="arrow-right" size={13} />
      </Link>
    </div>
  )
}

/** Customer → Activity: one card per order (steps + products on click), then account events. */
export function ProfileActivity({ profile }: { profile: CustomerProfile }) {
  const orders = profile.orders
  const [openId, setOpenId] = useState<string | null>(null)
  const [showAccount, setShowAccount] = useState(false)
  const open = orders.find((o) => o._id === openId) ?? null
  const account = profile.timeline.filter((e) => !e.orderId)

  return (
    <div className="space-y-4">
      <Section title={`Orders (${orders.length})`}>
        {orders.length ? (
          <ul className="-mx-1 divide-y divide-[var(--border)] sm:-mx-2">
            {orders.map((o) => (
              <OrderLine key={o._id} order={o} onOpen={() => setOpenId(o._id)} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--fg-muted)]">No orders yet.</p>
        )}
      </Section>

      <Modal open={Boolean(open)} onClose={() => setOpenId(null)} title={open ? `Order #${open.orderNumber}` : ''} size="lg">
        {open ? <OrderDetails order={open} /> : null}
      </Modal>
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
