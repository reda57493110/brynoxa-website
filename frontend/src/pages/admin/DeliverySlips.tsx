import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { CONTACT } from '@/lib/site'
import { formatCurrency, formatDateTime } from '@/lib/format'
import type { Order } from '@/types'
import { feesCovered, toCollect } from '@/lib/deposit'


function Slip({ order: o }: { order: Order }) {
  const a = o.shippingAddress
  const depositPaid = o.deposit?.status === 'received' ? o.deposit.amount : 0
  return (
    <article className="slip mx-auto flex w-full max-w-[148mm] flex-col gap-3 rounded-xl border border-black/20 bg-white p-5 text-[12px] leading-snug text-black print:rounded-none print:border-0 print:p-0">
      <header className="flex items-start justify-between gap-4 border-b border-black/20 pb-3">
        <div>
          <p className="text-lg font-bold tracking-tight">Brynoxa</p>
          <p>
            {CONTACT.phone.value} · {CONTACT.email.value}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-black/60">Delivery slip</p>
          <p className="text-base font-bold">#{o.orderNumber}</p>
          <p className="text-black/70">{formatDateTime(o.createdAt)}</p>
        </div>
      </header>

      <section>
        <p className="text-[10px] uppercase tracking-wide text-black/60">Deliver to</p>
        <p className="text-sm font-bold">{a?.fullName}</p>
        <p className="text-sm font-semibold">{a?.phone}</p>
        <p>
          {a?.line1}
          {a?.line2 ? `, ${a.line2}` : ''}
        </p>
        <p className="font-semibold uppercase">
          {a?.city}
          {a?.postalCode ? ` ${a.postalCode}` : ''}
        </p>
      </section>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-black/30 text-left text-[10px] uppercase tracking-wide text-black/60">
            <th className="py-1 font-medium">Item</th>
            <th className="w-10 py-1 text-center font-medium">Qty</th>
            <th className="w-24 py-1 text-right font-medium">Price</th>
          </tr>
        </thead>
        <tbody>
          {o.items.map((i, idx) => (
            <tr key={idx} className="border-b border-black/10 align-top">
              <td className="py-1 pr-2">
                {i.name}
                <span className="block text-[10px] text-black/60">{i.sku}</span>
              </td>
              <td className="py-1 text-center font-semibold">{i.qty}</td>
              <td className="py-1 text-right">{formatCurrency(i.price * i.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="ml-auto w-56 space-y-0.5">
        {o.pricing.shipping ? (
          <div className="flex justify-between">
            <dt>Shipping</dt>
            <dd>{formatCurrency(o.pricing.shipping)}</dd>
          </div>
        ) : null}
        {o.pricing.discount ? (
          <div className="flex justify-between">
            <dt>Discount</dt>
            <dd>−{formatCurrency(o.pricing.discount)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt>Total</dt>
          <dd>{formatCurrency(o.pricing.total)}</dd>
        </div>
        {depositPaid ? (
          <div className="flex justify-between">
            <dt>Deposit paid</dt>
            <dd>−{formatCurrency(depositPaid)}</dd>
          </div>
        ) : null}
        {depositPaid && feesCovered(o) ? (
          <div className="flex justify-between">
            <dt>Transfer fees covered</dt>
            <dd>−{formatCurrency(feesCovered(o))}</dd>
          </div>
        ) : null}
        <div className="mt-1 flex justify-between border-t-2 border-black pt-1 text-sm font-bold">
          <dt>To collect (cash)</dt>
          <dd>{formatCurrency(toCollect(o))}</dd>
        </div>
      </dl>

      {o.customerNote ? (
        <p className="rounded border border-black/20 p-2">
          <span className="font-semibold">Customer note: </span>
          {o.customerNote}
        </p>
      ) : null}

      <footer className="mt-auto grid grid-cols-2 gap-6 pt-6 text-[10px] text-black/60">
        <p className="border-t border-black/40 pt-1">Received by (name & signature)</p>
        <p className="border-t border-black/40 pt-1">Date</p>
      </footer>
    </article>
  )
}

/**
 * Printable delivery slips (one per page, A5) for the orders in `?ids=`.
 * Opened from Orders (bulk) or an order's page; prints automatically once loaded.
 */
export function DeliverySlips() {
  const [params] = useSearchParams()
  const ids = (params.get('ids') || '').split(',').filter((id) => /^[a-f0-9]{24}$/i.test(id)).slice(0, 50)

  const orders = useQuery({
    queryKey: ['admin-order-slips', ids],
    queryFn: async () => Promise.all(ids.map(async (id) => (await adminApi.orders.get(id)).data.data)),
    enabled: ids.length > 0,
  })

  useEffect(() => {
    if (!orders.data?.length) return
    const id = window.setTimeout(() => window.print(), 400)
    return () => window.clearTimeout(id)
  }, [orders.data])

  return (
    <div className="min-h-dvh bg-[var(--bg-muted)] p-4 print:bg-white print:p-0">
      <style>{'@page { size: A5; margin: 10mm } @media print { .slip { break-after: page } .slip:last-child { break-after: auto } }'}</style>
      <div className="mx-auto mb-4 flex max-w-[148mm] items-center justify-between gap-2 print:hidden">
        <Link to="/admin/orders" className="text-sm text-[var(--brand-text)] hover:underline">
          ← Back to orders
        </Link>
        <Button size="sm" onClick={() => window.print()} disabled={!orders.data?.length}>
          Print {ids.length > 1 ? `${ids.length} slips` : 'slip'}
        </Button>
      </div>
      {!ids.length ? (
        <p className="text-center text-sm text-[var(--fg-muted)]">No orders selected.</p>
      ) : orders.isPending ? (
        <div className="flex justify-center py-24">
          <Spinner size="lg" />
        </div>
      ) : orders.isError ? (
        <QueryErrorState onRetry={() => orders.refetch()} />
      ) : (
        <div className="space-y-4 print:space-y-0">
          {orders.data.map((o) => (
            <Slip key={o._id} order={o} />
          ))}
        </div>
      )}
    </div>
  )
}
