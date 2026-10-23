import { useEffect, useState, type ReactNode } from 'react'
import { ORDER_ORIGIN_LABEL, originOf } from '@/lib/orderOrigin'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { SafeImage } from '@/components/ui/SafeImage'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { Panel } from '@/components/admin/Panel'
import { Kpi, kpiGridClass } from '@/components/admin/analytics/Kit'
import { ProductCostSheet } from '@/components/admin/ProductCostSheet'
import { dayLabel } from '@/lib/salesBuckets'
import { formatCurrency, formatCurrencyRounded } from '@/lib/format'
import { optimizedImageUrl } from '@/lib/image'
import { cn } from '@/lib/cn'
import { toast } from '@/store/toastStore'
import type { ExpenseCategory, ProfitOrderKind, ProfitOrderRow, ProfitReport, SalesRange } from '@/types'

const RANGES: { value: SalesRange; label: string }[] = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
  { value: 180, label: '6m' },
  { value: 365, label: '1y' },
]

const TABS = [
  { id: 'costs', label: 'Product costs' },
  { id: 'orders', label: 'Orders' },
  { id: 'products', label: 'Sold products' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'courier', label: 'Courier prices' },
] as const
type Tab = (typeof TABS)[number]['id']

const KIND_LABEL: Record<ProfitOrderKind, string> = {
  sale: 'Sold',
  failed: 'Not delivered',
  open: 'In progress',
  cancelled: 'Cancelled',
}
const KIND_TONE: Record<ProfitOrderKind, string> = {
  sale: 'bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-[var(--success)]',
  failed: 'bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[var(--danger)]',
  open: 'bg-[var(--bg-muted)] text-[var(--fg-muted)]',
  cancelled: 'bg-[var(--bg-muted)] text-[var(--fg-muted)]',
}

const EXPENSE_LABEL: Record<ExpenseCategory, string> = {
  ads: 'Ads & marketing',
  packaging: 'Packaging',
  delivery: 'Delivery & courier',
  rent: 'Rent & bills',
  salaries: 'Salaries',
  tools: 'Tools & subscriptions',
  other: 'Other',
}

const money = (n: number) => formatCurrency(n)
const signed = (n: number) => (n < 0 ? `−${formatCurrency(Math.abs(n))}` : formatCurrency(n))
const todayKey = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca' }).format(new Date())

/** Parses a DH amount typed by staff; '' → null. */
function parseAmount(v: string): number | null | undefined {
  const s = v.trim().replace(',', '.')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

/** Where the money went: money in, each cost, what is left. */
function Breakdown({ r }: { r: ProfitReport }) {
  const t = r.totals
  const [open, setOpen] = useState(false)
  const line = (label: ReactNode, value: number, hint?: ReactNode, negative = true) => (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="min-w-0">
        <span>{label}</span>
        {hint ? <span className="block text-[11px] text-[var(--fg-muted)]">{hint}</span> : null}
      </dt>
      <dd className={cn('shrink-0 tabular-nums', negative && value > 0 && 'text-[var(--danger)]')}>
        {negative && value > 0 ? `−${money(value)}` : money(value)}
      </dd>
    </div>
  )
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] sm:rounded-2xl">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-3 py-3 text-start transition hover:bg-[var(--bg-muted)] sm:px-5"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Where the money went</span>
          <span className="block text-xs text-[var(--fg-muted)]">{open ? `${dayLabel(r.from)} – ${dayLabel(r.to)} · orders by the day they were placed` : 'Click to see each cost'}</span>
        </span>
        <span className={cn('shrink-0 font-display text-base font-semibold tabular-nums', t.netProfit < 0 ? 'text-[var(--danger)]' : 'text-[var(--success)]')}>
          {signed(t.netProfit)}
        </span>
        <SiteIcon name="chevron-down" size={16} className={cn('shrink-0 text-[var(--fg-muted)] transition', open && 'rotate-180')} />
      </button>
      {open ? (
      <div className="space-y-3 border-t border-[var(--border)] px-3 py-3 sm:px-5 sm:py-4">
      <dl className="divide-y divide-[var(--border)] text-sm">
        {line(
          'Money received',
          t.moneyIn,
          <>
            {t.sales} delivered sale{t.sales === 1 ? '' : 's'}
            {t.shippingCharged > 0 ? ` · incl. ${money(t.shippingCharged)} shipping paid by customers` : ''}
            {t.moneyIn > t.salesValue ? ` · ${money(t.moneyIn - t.salesValue)} deposits kept` : ''}
          </>,
          false
        )}
        {line('Product cost', t.productCost, 'What the products sold cost you')}
        {line(
          'Delivery (courier)',
          t.delivery,
          <>
            {money(r.courierCosts.delivered)} per delivered parcel · {money(r.courierCosts.returned)} per returned parcel
          </>
        )}
        {t.fees > 0 ? line('Transfer fees you covered', t.fees, 'Taken off what the courier collected') : null}
        {t.other > 0 ? line('Other order costs', t.other, 'Packaging, gifts… added per order') : null}
        {line('Expenses', t.expenses, r.expensesByCategory.map((c) => `${EXPENSE_LABEL[c.category]} ${formatCurrencyRounded(c.amount)}`).join(' · ') || 'Ads, rent, packaging… (Expenses tab)')}
        <div className="flex items-baseline justify-between gap-3 pt-2.5">
          <dt className="font-semibold">Net profit</dt>
          <dd className={cn('font-display text-lg font-semibold tabular-nums', t.netProfit < 0 ? 'text-[var(--danger)]' : 'text-[var(--success)]')}>
            {signed(t.netProfit)}
          </dd>
        </div>
      </dl>
      {t.failed > 0 || t.open > 0 ? (
        <p className="text-xs text-[var(--fg-muted)]">
          {t.failed > 0 ? `${t.failed} parcel${t.failed === 1 ? '' : 's'} not delivered cost you ${money(Math.max(0, t.failedLoss))} (included above). ` : ''}
          {t.open > 0 ? `${t.open} order${t.open === 1 ? '' : 's'} still in progress (${money(t.openValue)}) count once delivered.` : ''}
        </p>
      ) : null}
      </div>
      ) : null}
    </section>
  )
}

/** Finished sales per source: the website, Instagram, the shop… */
function SalesBySource({ r }: { r: ProfitReport }) {
  const rows = (r.bySource ?? []).slice().sort((a, b) => b.moneyIn - a.moneyIn)
  if (!rows.length) return null
  const best = Math.max(...rows.map((x) => x.moneyIn), 1)
  return (
    <section className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-3 sm:rounded-2xl sm:px-5">
      <p className="text-sm font-semibold">Where your sales come from</p>
      <p className="text-xs text-[var(--fg-muted)]">Delivered orders by source · add social media and shop sales in Orders → New order</p>
      <ul className="mt-3 space-y-2.5">
        {rows.map((s) => (
          <li key={s.origin} className="text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate font-medium">{ORDER_ORIGIN_LABEL[originOf(s)]}</span>
              <span className="shrink-0 tabular-nums">
                {money(s.moneyIn)}
                <span className={cn('ms-2 text-xs', s.profit < 0 ? 'text-[var(--danger)]' : 'text-[var(--success)]')}>{signed(s.profit)}</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--bg-muted)]">
              <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${Math.max(2, (s.moneyIn / best) * 100)}%` }} />
            </div>
            <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">
              {s.sales} sale{s.sales === 1 ? '' : 's'}
              {s.open ? ` · ${s.open} in progress` : ''}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function OrderCostsEditor({ row, onDone }: { row: ProfitOrderRow; onDone: () => void }) {
  const qc = useQueryClient()
  const [delivery, setDelivery] = useState(row.deliveryIsDefault ? '' : String(row.delivery))
  const [other, setOther] = useState(row.other ? String(row.other) : '')
  const [note, setNote] = useState(row.note)
  const d = parseAmount(delivery)
  const o = parseAmount(other)
  const save = useMutation({
    mutationFn: () => adminApi.profit.setOrderCosts(row.id, { delivery: d ?? null, other: o ?? null, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-profit'] })
      toast.success('Order costs saved')
      onDone()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
      <Input
        label="Delivery cost (DH)"
        inputMode="decimal"
        placeholder={`Default ${row.kind === 'failed' ? 'returned' : 'delivered'} price`}
        value={delivery}
        onChange={(e) => setDelivery(e.target.value)}
        error={d === undefined ? 'Enter 0 or more' : undefined}
      />
      <Input
        label="Other costs (DH)"
        inputMode="decimal"
        placeholder="0"
        value={other}
        onChange={(e) => setOther(e.target.value)}
        error={o === undefined ? 'Enter 0 or more' : undefined}
      />
      <Input label="Note" placeholder="e.g. extra packaging, gift" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" className="h-11" loading={save.isPending} disabled={d === undefined || o === undefined} onClick={() => save.mutate()}>
          Save
        </Button>
        <Button size="sm" variant="ghost" className="h-11" onClick={onDone}>
          Close
        </Button>
      </div>
      <p className="text-[11px] text-[var(--fg-muted)] sm:col-span-4">Leave delivery empty to use the default courier price.</p>
    </div>
  )
}

function OrdersTab({ r }: { r: ProfitReport }) {
  const [kind, setKind] = useState<ProfitOrderKind | 'all'>('all')
  const [editing, setEditing] = useState<string | null>(null)
  const counts = r.orders.reduce<Record<string, number>>((a, o) => ({ ...a, [o.kind]: (a[o.kind] ?? 0) + 1 }), {})
  const rows = kind === 'all' ? r.orders : r.orders.filter((o) => o.kind === kind)
  const filters = (['all', 'sale', 'failed', 'open', 'cancelled'] as const).filter((k) => k === 'all' || counts[k])

  return (
    <Panel
      title="Profit per order"
      description="Click Costs to set the real delivery price or add other costs for one order."
      actions={
        <div className="flex flex-wrap gap-1">
          {filters.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                'h-8 rounded-full border px-3 text-xs font-medium',
                kind === k ? 'border-transparent bg-[var(--brand)] text-[var(--brand-fg)]' : 'border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]'
              )}
            >
              {k === 'all' ? 'All' : KIND_LABEL[k]} {k === 'all' ? r.orders.length : counts[k]}
            </button>
          ))}
        </div>
      }
    >
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--fg-muted)]">No orders in this period.</p>
      ) : (
        <div className="-mx-3 overflow-x-auto sm:-mx-5">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--fg-muted)]">
                <th className="px-3 py-2 font-medium sm:ps-5">Order</th>
                <th className="px-2 py-2 text-right font-medium">Money in</th>
                <th className="px-2 py-2 text-right font-medium">Products</th>
                <th className="px-2 py-2 text-right font-medium">Delivery</th>
                <th className="px-2 py-2 text-right font-medium">Fees</th>
                <th className="px-2 py-2 text-right font-medium">Other</th>
                <th className="px-2 py-2 text-right font-medium">Profit</th>
                <th className="px-3 py-2 sm:pe-5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <OrderRow key={o.id} o={o} editing={editing === o.id} onEdit={() => setEditing(editing === o.id ? null : o.id)} onDone={() => setEditing(null)} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

function OrderRow({ o, editing, onEdit, onDone }: { o: ProfitOrderRow; editing: boolean; onEdit: () => void; onDone: () => void }) {
  const counted = o.kind !== 'open'
  const dim = (n: number) => (n ? <span className="text-[var(--danger)]">−{money(n)}</span> : <span className="text-[var(--fg-muted)]">—</span>)
  return (
    <>
      <tr className="border-b border-[var(--border)] align-top last:border-0">
        <td className="px-3 py-2 sm:ps-5">
          <Link to={`/admin/orders/${o.id}`} className="font-medium text-[var(--brand-text)] hover:underline">
            {o.orderNumber}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--fg-muted)]">
            <span className={cn('rounded-full px-1.5 py-px font-medium', KIND_TONE[o.kind])}>{KIND_LABEL[o.kind]}</span>
            <span>{dayLabel(o.day)}</span>
            {o.customer ? <span className="max-w-[10rem] truncate">· {o.customer}</span> : null}
          </div>
          {o.note ? <p className="mt-0.5 text-[11px] text-[var(--fg-muted)]">“{o.note}”</p> : null}
        </td>
        <td className="px-2 py-2 whitespace-nowrap text-right tabular-nums">{counted ? money(o.moneyIn) : <span className="text-[var(--fg-muted)]">{money(o.total)}</span>}</td>
        <td className="px-2 py-2 whitespace-nowrap text-right tabular-nums">
          {o.missingCost ? (
            <span className="text-[var(--warning)]" title="A product in this order has no cost price">
              {o.productCost ? `−${money(o.productCost)} ` : ''}no cost
            </span>
          ) : (
            dim(o.productCost)
          )}
        </td>
        <td className="px-2 py-2 whitespace-nowrap text-right tabular-nums">
          {dim(o.delivery)}
          {o.delivery && o.deliveryIsDefault ? <span className="block text-[10px] text-[var(--fg-muted)]">default</span> : null}
        </td>
        <td className="px-2 py-2 whitespace-nowrap text-right tabular-nums">{dim(o.fees)}</td>
        <td className="px-2 py-2 whitespace-nowrap text-right tabular-nums">{dim(o.other)}</td>
        <td className={cn('px-2 py-2 whitespace-nowrap text-right font-semibold tabular-nums', counted && (o.profit < 0 ? 'text-[var(--danger)]' : 'text-[var(--success)]'))}>
          {counted ? signed(o.profit) : <span className="text-xs font-normal text-[var(--fg-muted)]">when delivered</span>}
        </td>
        <td className="px-3 py-2 text-right sm:pe-5">
          <button type="button" onClick={onEdit} className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--border)] px-2.5 text-xs hover:border-[var(--brand)]">
            <SiteIcon name="pencil" size={12} />
            Costs
          </button>
        </td>
      </tr>
      {editing ? (
        <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]/40">
          <td colSpan={8} className="px-3 py-3 sm:px-5">
            <OrderCostsEditor row={o} onDone={onDone} />
          </td>
        </tr>
      ) : null}
    </>
  )
}

/** Inline "set cost price" for a product; also fills past orders that had no cost. */
function CostInput({ productId, initial }: { productId: string; initial?: number | null }) {
  const qc = useQueryClient()
  const [value, setValue] = useState(initial != null ? String(initial) : '')
  const parsed = parseAmount(value)
  const save = useMutation({
    mutationFn: (cost: number) => adminApi.profit.setProductCost(productId, { costPrice: cost }, true),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-profit'] })
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
      const n = res.data.data.ordersUpdated
      toast.success(n ? `Cost saved · ${n} past order${n === 1 ? '' : 's'} updated` : 'Cost saved')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  return (
    <form
      className="flex items-center justify-end gap-1.5"
      onSubmit={(e) => {
        e.preventDefault()
        if (typeof parsed === 'number') save.mutate(parsed)
      }}
    >
      <input
        inputMode="decimal"
        aria-label="Cost price (DH)"
        placeholder="Cost DH"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 w-24 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 text-right text-sm tabular-nums outline-none focus:border-[var(--brand)]"
      />
      <Button type="submit" size="sm" variant="outline" className="h-8" loading={save.isPending} disabled={typeof parsed !== 'number'}>
        Save
      </Button>
    </form>
  )
}

function ProductThumb({ image, name }: { image?: string; name: string }) {
  return (
    <span className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-muted)]">
      {image ? <SafeImage src={optimizedImageUrl(image, 96)} alt={name} className="size-full object-cover" /> : null}
    </span>
  )
}

function ProductsTab({ r }: { r: ProfitReport }) {
  return (
    <div className="space-y-4">
      <Panel title="Profit per product" description="Delivered units only. Order costs (delivery, fees) are not split per product.">
        {r.products.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--fg-muted)]">No delivered sales in this period.</p>
        ) : (
          <div className="-mx-3 overflow-x-auto sm:-mx-5">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs text-[var(--fg-muted)]">
                  <th className="px-3 py-2 font-medium sm:ps-5">Product</th>
                  <th className="px-2 py-2 text-right font-medium">Sold</th>
                  <th className="px-2 py-2 text-right font-medium">Sales</th>
                  <th className="px-2 py-2 text-right font-medium">Cost</th>
                  <th className="px-3 py-2 text-right font-medium sm:pe-5">Profit</th>
                </tr>
              </thead>
              <tbody>
                {r.products.map((p) => (
                  <tr key={p.productId} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-3 py-2 sm:ps-5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <ProductThumb image={p.image} name={p.name} />
                        {p.exists ? (
                          <Link to={`/admin/products/${p.productId}/edit`} className="line-clamp-2 min-w-0 font-medium hover:text-[var(--brand-text)]">
                            {p.name}
                          </Link>
                        ) : (
                          <span className="line-clamp-2 min-w-0 font-medium">{p.name}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap text-right tabular-nums">{p.units}</td>
                    <td className="px-2 py-2 whitespace-nowrap text-right tabular-nums">{money(p.revenue)}</td>
                    <td className="px-2 py-2 whitespace-nowrap text-right tabular-nums">
                      {p.missingCost ? (
                        p.exists ? (
                          <CostInput productId={p.productId} initial={p.costPrice} />
                        ) : (
                          <span className="text-[var(--warning)]">no cost</span>
                        )
                      ) : (
                        <span className="text-[var(--danger)]">−{money(p.cost)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right tabular-nums sm:pe-5">
                      {p.missingCost ? (
                        <span className="text-xs text-[var(--fg-muted)]">set the cost</span>
                      ) : (
                        <>
                          <span className={cn('font-semibold', p.profit < 0 ? 'text-[var(--danger)]' : 'text-[var(--success)]')}>{signed(p.profit)}</span>
                          {p.margin !== null ? <span className="block text-[10px] text-[var(--fg-muted)]">{p.margin}% margin</span> : null}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {r.productsWithoutCost.length > 0 ? (
        <Panel
          title={`Products without a cost price (${r.productsWithoutCost.length}${r.productsWithoutCost.length === 50 ? '+' : ''})`}
          description="Enter what you paid for each one. Past orders of that product without a cost get it too."
        >
          <ul className="divide-y divide-[var(--border)]">
            {r.productsWithoutCost.map((p) => (
              <li key={p.productId} className="flex items-center gap-2.5 py-2">
                <ProductThumb image={p.image} name={p.name} />
                <div className="min-w-0 flex-1">
                  <Link to={`/admin/products/${p.productId}/edit`} className="line-clamp-1 text-sm font-medium hover:text-[var(--brand-text)]">
                    {p.name}
                  </Link>
                  <p className="text-[11px] text-[var(--fg-muted)]">
                    Sells for {money(p.price)}
                    {p.sku ? ` · ${p.sku}` : ''}
                  </p>
                </div>
                <CostInput productId={p.productId} />
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  )
}

function ExpensesTab({ r }: { r: ProfitReport }) {
  const qc = useQueryClient()
  const [label, setLabel] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('ads')
  const [amount, setAmount] = useState('')
  const [day, setDay] = useState(todayKey)
  const parsed = parseAmount(amount)
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-profit'] })
    qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
  }
  const add = useMutation({
    mutationFn: () => adminApi.profit.addExpense({ label: label.trim(), category, amount: parsed as number, day }),
    onSuccess: () => {
      refresh()
      setLabel('')
      setAmount('')
      toast.success('Expense added')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: (id: string) => adminApi.profit.deleteExpense(id),
    onSuccess: () => {
      refresh()
      toast.success('Expense deleted')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const canAdd = label.trim() && typeof parsed === 'number' && parsed > 0 && day

  return (
    <div className="space-y-4">
      <Panel title="Add an expense" description="Money spent that is not tied to one order: Facebook ads, boxes, rent, a salary…">
        <form
          className="grid gap-2 sm:grid-cols-[2fr_1.3fr_1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            if (canAdd) add.mutate()
          }}
        >
          <Input label="What" placeholder="e.g. Facebook ads – October" maxLength={120} value={label} onChange={(e) => setLabel(e.target.value)} />
          <Select
            label="Type"
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            options={(Object.keys(EXPENSE_LABEL) as ExpenseCategory[]).map((c) => ({ value: c, label: EXPENSE_LABEL[c] }))}
          />
          <Input label="Amount (DH)" inputMode="decimal" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input label="Date" type="date" value={day} max={todayKey()} onChange={(e) => setDay(e.target.value)} />
          <Button type="submit" className="h-11" loading={add.isPending} disabled={!canAdd}>
            Add
          </Button>
        </form>
      </Panel>

      <Panel title={`Expenses · ${formatCurrency(r.totals.expenses)}`} description={`${dayLabel(r.from)} – ${dayLabel(r.to)}`}>
        {r.expenses.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--fg-muted)]">No expenses in this period.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {r.expenses.map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{e.label}</p>
                  <p className="text-[11px] text-[var(--fg-muted)]">
                    {EXPENSE_LABEL[e.category]} · {dayLabel(e.day)}
                  </p>
                </div>
                <span className="shrink-0 tabular-nums text-[var(--danger)]">−{money(e.amount)}</span>
                <button
                  type="button"
                  aria-label={`Delete ${e.label}`}
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm(`Delete "${e.label}"?`)) remove.mutate(e.id)
                  }}
                  className="grid size-8 shrink-0 place-items-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--danger)]"
                >
                  <SiteIcon name="trash" size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

function CourierTab({ r }: { r: ProfitReport }) {
  const qc = useQueryClient()
  const [delivered, setDelivered] = useState(String(r.courierCosts.delivered || ''))
  const [returned, setReturned] = useState(String(r.courierCosts.returned || ''))
  useEffect(() => {
    setDelivered(String(r.courierCosts.delivered || ''))
    setReturned(String(r.courierCosts.returned || ''))
  }, [r.courierCosts.delivered, r.courierCosts.returned])
  const d = parseAmount(delivered)
  const ret = parseAmount(returned)
  const save = useMutation({
    mutationFn: () => adminApi.profit.setCourier({ delivered: d ?? 0, returned: ret ?? 0 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-profit'] })
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
      toast.success('Courier prices saved')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  return (
    <Panel
      title="What the courier charges you"
      description="Used for every order unless you set a different delivery cost on that order. Changing it updates past periods too."
    >
      <div className="grid max-w-xl gap-3 sm:grid-cols-2">
        <Input
          label="Per delivered parcel (DH)"
          inputMode="decimal"
          placeholder="e.g. 35"
          value={delivered}
          onChange={(e) => setDelivered(e.target.value)}
          error={d === undefined ? 'Enter 0 or more' : undefined}
        />
        <Input
          label="Per parcel sent back (DH)"
          inputMode="decimal"
          placeholder="e.g. 15"
          value={returned}
          onChange={(e) => setReturned(e.target.value)}
          error={ret === undefined ? 'Enter 0 or more' : undefined}
        />
      </div>
      <p className="text-xs text-[var(--fg-muted)]">
        Sent back = refused or failed delivery. The shipping fee the customer pays is already counted in money received.
      </p>
      <Button loading={save.isPending} disabled={d === undefined || ret === undefined} onClick={() => save.mutate()}>
        Save courier prices
      </Button>
    </Panel>
  )
}

function Loading() {
  return (
    <div className="space-y-4">
      <div className={kpiGridClass}>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[6.5rem] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  )
}

/**
 * Admin → Profit: what the shop really earned — money received minus product cost, courier,
 * transfer fees, per-order costs and expenses. Owner / admin only ("reports" permission).
 */
export function Profit() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'costs') as Tab
  const [range, setRange] = useState<SalesRange>(30)

  const report = useQuery({
    queryKey: ['admin-profit', range],
    queryFn: async () => (await adminApi.profit.report(range)).data.data,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  })
  const r = report.data
  const t = r?.totals
  const costs = t ? t.productCost + t.delivery + t.fees + t.other + t.expenses : 0

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <AdminHeader
        title="Profit"
        description="What you really earn: money received minus product cost, delivery, fees and expenses"
        actions={
          <>
            <div role="radiogroup" aria-label="Period" className="inline-flex rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] p-0.5">
              {RANGES.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={range === o.value}
                  onClick={() => setRange(o.value)}
                  className={cn(
                    'h-8 rounded-full px-3 text-sm font-medium transition',
                    range === o.value ? 'bg-[var(--brand)] text-[var(--brand-fg)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <a href={`/admin-print/profit?days=${range}`} target="_blank" rel="noopener">
              <Button type="button" size="sm" variant="outline">
                Download report
              </Button>
            </a>
          </>
        }
      />

      {report.isError && !r ? (
        <QueryErrorState onRetry={() => report.refetch()} />
      ) : !r || !t ? (
        <Loading />
      ) : (
        <div className={cn('space-y-4 sm:space-y-6', report.isFetching && 'opacity-60 transition-opacity')}>
          <div className={kpiGridClass}>
            <Kpi
              label="Net profit"
              value={<span className={t.netProfit < 0 ? 'text-[var(--danger)]' : undefined}>{signed(Math.round(t.netProfit))}</span>}
              hint={<span className="text-[var(--fg-muted)]">{t.margin !== null ? `${t.margin}% of money received` : 'No sales yet'}</span>}
              icon="banknote"
            />
            <Kpi
              label="Money received"
              value={formatCurrencyRounded(t.moneyIn)}
              hint={<span className="text-[var(--fg-muted)]">{t.sales} delivered sale{t.sales === 1 ? '' : 's'}</span>}
              icon="package-check"
            />
            <Kpi
              label="All costs"
              value={formatCurrencyRounded(costs)}
              hint={<span className="text-[var(--fg-muted)]">Products {formatCurrencyRounded(t.productCost)}</span>}
              icon="tag"
            />
            <Kpi
              label="Delivery & expenses"
              value={formatCurrencyRounded(t.delivery + t.fees + t.other + t.expenses)}
              hint={<span className="text-[var(--fg-muted)]">Courier {formatCurrencyRounded(t.delivery)}</span>}
              icon="truck"
            />
          </div>

          {t.salesMissingCost > 0 ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-[color-mix(in_srgb,var(--warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-3 py-2.5 text-sm">
              <SiteIcon name="alert" size={16} className="mt-0.5 shrink-0 text-[var(--warning)]" />
              <p className="min-w-0">
                <span className="font-medium">
                  {t.salesMissingCost} sale{t.salesMissingCost === 1 ? ' has' : 's have'} a product without a cost price
                </span>
                , so the profit shows higher than it really is.{' '}
                <button type="button" className="font-medium text-[var(--brand-text)] hover:underline" onClick={() => setParams({})}>
                  Set the costs
                </button>
              </p>
            </div>
          ) : null}

          <Breakdown r={r} />
          <SalesBySource r={r} />

          <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-[var(--border)]">
            {TABS.map((x) => (
              <button
                key={x.id}
                type="button"
                role="tab"
                aria-selected={tab === x.id}
                onClick={() => setParams(x.id === 'costs' ? {} : { tab: x.id }, { replace: true })}
                className={cn(
                  '-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition',
                  tab === x.id ? 'border-[var(--brand)] text-[var(--fg)]' : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]'
                )}
              >
                {x.label}
                {x.id === 'costs' && r.productsWithoutCost.length ? (
                  <span className="ms-1.5 rounded-full bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] px-1.5 text-[10px] text-[var(--warning)]">
                    {r.productsWithoutCost.length}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {tab === 'costs' ? <ProductCostSheet /> : null}
          {tab === 'orders' ? <OrdersTab r={r} /> : null}
          {tab === 'products' ? <ProductsTab r={r} /> : null}
          {tab === 'expenses' ? <ExpensesTab r={r} /> : null}
          {tab === 'courier' ? <CourierTab r={r} /> : null}
        </div>
      )}
    </div>
  )
}
