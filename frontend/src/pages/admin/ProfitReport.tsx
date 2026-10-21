import { useEffect, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { formatCurrency } from '@/lib/format'
import { dayLabel } from '@/lib/salesBuckets'
import { cn } from '@/lib/cn'
import type { ExpenseCategory, ProfitOrderKind, ProfitReport as Report, SalesRange } from '@/types'

const RANGES: { value: SalesRange; label: string }[] = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '6 months' },
  { value: 365, label: '1 year' },
]

const EXPENSE_LABEL: Record<ExpenseCategory, string> = {
  ads: 'Ads & marketing',
  packaging: 'Packaging',
  delivery: 'Delivery & courier',
  rent: 'Rent & bills',
  salaries: 'Salaries',
  tools: 'Tools & subscriptions',
  other: 'Other',
}

const RESULT: Record<ProfitOrderKind, { label: string; cls: string }> = {
  sale: { label: 'Sold', cls: 'bg-emerald-50 text-emerald-700' },
  failed: { label: 'Not delivered', cls: 'bg-rose-50 text-rose-700' },
  open: { label: 'In progress', cls: 'bg-slate-100 text-slate-600' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500' },
}

// Fixed colours: the report is always printed on white paper
const SLICES = [
  { key: 'productCost', label: 'Product cost', color: '#64748b' },
  { key: 'delivery', label: 'Delivery', color: '#0ea5e9' },
  { key: 'fees', label: 'Transfer fees', color: '#a855f7' },
  { key: 'other', label: 'Other order costs', color: '#f59e0b' },
  { key: 'expenses', label: 'Expenses', color: '#f43f5e' },
  { key: 'netProfit', label: 'Net profit', color: '#10b981' },
] as const

const dh = (n: number) => formatCurrency(n)
const signed = (n: number) => (n < 0 ? `−${formatCurrency(-n)}` : formatCurrency(n))
const pctOf = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 1000) / 10}%` : '—')

function Title({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-slate-200 pb-1.5">
      <h2 className="text-[13px] font-bold tracking-wide text-slate-900 uppercase">{children}</h2>
      {hint ? <span className="text-[10px] text-slate-500">{hint}</span> : null}
    </div>
  )
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-xl border border-slate-200 px-3 py-2.5">
      <p className="text-[10px] font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className={cn('mt-0.5 text-lg font-bold tabular-nums', tone === 'good' ? 'text-emerald-600' : tone === 'bad' ? 'text-rose-600' : 'text-slate-900')}>
        {value}
      </p>
      {sub ? <p className="text-[10px] text-slate-500">{sub}</p> : null}
    </div>
  )
}

/** Money received split into where it went (one bar). */
function MoneyBar({ r }: { r: Report }) {
  const t = r.totals
  const parts = SLICES.map((s) => ({ ...s, value: Math.max(0, t[s.key]) }))
  const whole = Math.max(t.moneyIn, parts.reduce((a, p) => a + p.value, 0))
  return (
    <div>
      <div className="flex h-5 w-full overflow-hidden rounded-full bg-slate-100">
        {whole > 0
          ? parts.map((p) =>
              p.value > 0 ? <span key={p.key} style={{ width: `${(p.value / whole) * 100}%`, background: p.color }} className="h-full" title={p.label} /> : null
            )
          : null}
      </div>
      <ul className="mt-2.5 grid grid-cols-2 sm:grid-cols-3 print:grid-cols-3 gap-x-4 gap-y-1.5 text-[11px]">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5">
            <span className="size-2.5 shrink-0 rounded-sm" style={{ background: p.color }} />
            <span className="min-w-0 flex-1 truncate text-slate-600">{p.label}</span>
            <span className="font-semibold tabular-nums text-slate-900">{pctOf(p.value, t.moneyIn)}</span>
          </li>
        ))}
      </ul>
      {t.netProfit < 0 ? <p className="mt-1.5 text-[11px] font-medium text-rose-600">Costs were higher than the money received: a loss of {dh(-t.netProfit)}.</p> : null}
    </div>
  )
}

function Statement({ r }: { r: Report }) {
  const t = r.totals
  const line = (label: string, value: number, hint?: string, minus = true) => (
    <tr className="border-b border-slate-100">
      <td className="py-1.5 pe-3">
        <span className="text-[12px] text-slate-800">{label}</span>
        {hint ? <span className="block text-[10px] text-slate-500">{hint}</span> : null}
      </td>
      <td className={cn('py-1.5 text-end text-[12px] tabular-nums', minus && value > 0 ? 'text-rose-600' : 'text-slate-900')}>
        {minus && value > 0 ? `−${dh(value)}` : dh(value)}
      </td>
      <td className="w-14 py-1.5 text-end text-[10px] text-slate-400 tabular-nums">{pctOf(value, t.moneyIn)}</td>
    </tr>
  )
  return (
    <table className="w-full">
      <tbody>
        {line('Money received', t.moneyIn, `${t.sales} delivered sale${t.sales === 1 ? '' : 's'}${t.shippingCharged ? ` · incl. ${dh(t.shippingCharged)} shipping paid by customers` : ''}`, false)}
        {line('Product cost', t.productCost, 'What the products sold cost you')}
        {line('Delivery (courier)', t.delivery, `${dh(r.courierCosts.delivered)} per delivered parcel · ${dh(r.courierCosts.returned)} per parcel sent back`)}
        {line('Transfer fees covered', t.fees)}
        {line('Other order costs', t.other, 'Packaging, gifts…')}
        {line('Expenses', t.expenses, r.expensesByCategory.map((c) => `${EXPENSE_LABEL[c.category]} ${dh(c.amount)}`).join(' · ') || undefined)}
        <tr>
          <td className="pt-2.5 text-[13px] font-bold text-slate-900">Net profit</td>
          <td className={cn('pt-2.5 text-end text-[15px] font-bold tabular-nums', t.netProfit < 0 ? 'text-rose-600' : 'text-emerald-600')}>{signed(t.netProfit)}</td>
          <td className="pt-2.5 text-end text-[10px] text-slate-400 tabular-nums">{t.margin !== null ? `${t.margin}%` : ''}</td>
        </tr>
      </tbody>
    </table>
  )
}

const th = 'py-1.5 text-[10px] font-semibold tracking-wide text-slate-500 uppercase'
const td = 'py-1.5 text-[11px] tabular-nums'

function ReportBody({ r }: { r: Report }) {
  const t = r.totals
  const costs = t.productCost + t.delivery + t.fees + t.other + t.expenses
  const products = r.products.slice(0, 15)
  const orders = r.orders

  return (
    <article className="report mx-auto w-full max-w-[210mm] bg-white px-4 py-5 sm:px-[14mm] sm:py-[12mm] text-slate-900 shadow-sm print:max-w-none print:px-0 print:py-0 print:shadow-none">
      {/* Header */}
      <header className="flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-4">
        <div className="flex items-center gap-3">
          <img src="/brand/brynoxa-mark.png" alt="" className="size-10 rounded-lg bg-[#080B0E]" />
          <div>
            <p className="text-lg leading-tight font-bold">Brynoxa</p>
            <p className="text-[11px] text-slate-500">Profit report</p>
          </div>
        </div>
        <div className="text-end">
          <p className="text-[13px] font-semibold">
            {dayLabel(r.from)} – {dayLabel(r.to)}
          </p>
          <p className="text-[10px] text-slate-500">
            Last {r.range} days · made {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </header>

      {/* Headline */}
      <section className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-[1.3fr_1fr_1fr_1fr] print:grid-cols-[1.3fr_1fr_1fr_1fr]">
        <div className={cn('rounded-xl px-4 py-3 text-white max-sm:col-span-2', t.netProfit < 0 ? 'bg-rose-600' : 'bg-emerald-600')}>
          <p className="text-[10px] font-medium tracking-wide uppercase opacity-90">Net profit</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums">{signed(t.netProfit)}</p>
          <p className="text-[10px] opacity-90">{t.margin !== null ? `${t.margin}% of money received` : 'No sales in this period'}</p>
        </div>
        <Stat label="Money received" value={dh(t.moneyIn)} sub={`${t.sales} delivered sale${t.sales === 1 ? '' : 's'}`} />
        <Stat label="All costs" value={dh(costs)} sub={`Products ${dh(t.productCost)}`} />
        <Stat
          label="Orders"
          value={String(t.sales + t.failed + t.open)}
          sub={`${t.failed} not delivered · ${t.open} in progress`}
          tone={t.failed > 0 && t.failed >= t.sales ? 'bad' : undefined}
        />
      </section>

      {t.salesMissingCost > 0 ? (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
          {t.salesMissingCost} sale{t.salesMissingCost === 1 ? ' has' : 's have'} a product without a cost price, so the real profit is lower than shown.
        </p>
      ) : null}

      {/* Where the money went */}
      <section className="mt-6 break-inside-avoid">
        <Title hint="share of the money received">Where the money went</Title>
        <MoneyBar r={r} />
      </section>

      <section className="mt-6 break-inside-avoid">
        <Title>Profit statement</Title>
        <Statement r={r} />
        {t.failed > 0 || t.open > 0 ? (
          <p className="mt-2 text-[10px] text-slate-500">
            {t.failed > 0 ? `${t.failed} parcel${t.failed === 1 ? '' : 's'} not delivered cost ${dh(Math.max(0, t.failedLoss))} (included above). ` : ''}
            {t.open > 0 ? `${t.open} order${t.open === 1 ? '' : 's'} still in progress (${dh(t.openValue)}) will count once delivered.` : ''}
          </p>
        ) : null}
      </section>

      {/* Products */}
      <section className="mt-6">
        <Title hint={r.products.length > products.length ? `top ${products.length} of ${r.products.length}` : undefined}>Best products</Title>
        {products.length ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 text-start">
                <th className={cn(th, 'text-start')}>Product</th>
                <th className={cn(th, 'text-end')}>Sold</th>
                <th className={cn(th, 'text-end')}>Sales</th>
                <th className={cn(th, 'text-end')}>Cost</th>
                <th className={cn(th, 'text-end')}>Profit</th>
                <th className={cn(th, 'text-end')}>Margin</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.productId} className="break-inside-avoid border-b border-slate-100">
                  <td className="max-w-[70mm] py-1.5 pe-2 text-[11px] font-medium">{p.name}</td>
                  <td className={cn(td, 'text-end')}>{p.units}</td>
                  <td className={cn(td, 'text-end')}>{dh(p.revenue)}</td>
                  <td className={cn(td, 'text-end text-slate-500')}>{p.missingCost ? 'no cost' : dh(p.cost)}</td>
                  <td className={cn(td, 'text-end font-semibold', p.missingCost ? 'text-slate-400' : p.profit < 0 ? 'text-rose-600' : 'text-emerald-600')}>
                    {p.missingCost ? '—' : signed(p.profit)}
                  </td>
                  <td className={cn(td, 'text-end text-slate-500')}>{p.missingCost || p.margin === null ? '—' : `${p.margin}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-[11px] text-slate-500">No delivered sales in this period.</p>
        )}
      </section>

      {/* Orders */}
      <section className="mt-6">
        <Title hint={`${orders.length} order${orders.length === 1 ? '' : 's'}`}>Orders</Title>
        {orders.length ? (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className={cn(th, 'text-start')}>Order</th>
                <th className={cn(th, 'text-start')}>Customer</th>
                <th className={cn(th, 'text-start')}>Result</th>
                <th className={cn(th, 'text-end')}>Received</th>
                <th className={cn(th, 'text-end')}>Costs</th>
                <th className={cn(th, 'text-end')}>Profit</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const c = o.productCost + o.delivery + o.fees + o.other
                const open = o.kind === 'open'
                return (
                  <tr key={o.id} className="break-inside-avoid border-b border-slate-100">
                    <td className="py-1.5 pe-2">
                      <span className="block text-[11px] font-medium">{o.orderNumber}</span>
                      <span className="block text-[9px] text-slate-500">{dayLabel(o.day)}</span>
                    </td>
                    <td className="max-w-[40mm] truncate py-1.5 pe-2 text-[11px]">{o.customer || '—'}</td>
                    <td className="py-1.5">
                      <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-semibold', RESULT[o.kind].cls)}>{RESULT[o.kind].label}</span>
                    </td>
                    <td className={cn(td, 'text-end')}>{open ? <span className="text-slate-400">{dh(o.total)}</span> : dh(o.moneyIn)}</td>
                    <td className={cn(td, 'text-end text-slate-500')}>{c ? `−${dh(c)}` : '—'}</td>
                    <td className={cn(td, 'text-end font-semibold', open ? 'font-normal text-slate-400' : o.profit < 0 ? 'text-rose-600' : 'text-emerald-600')}>
                      {open ? 'later' : signed(o.profit)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-[11px] text-slate-500">No orders in this period.</p>
        )}
      </section>

      {/* Expenses */}
      {r.expenses.length ? (
        <section className="mt-6 break-inside-avoid">
          <Title hint={dh(t.expenses)}>Expenses</Title>
          <table className="w-full">
            <tbody>
              {r.expenses.map((e) => (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="w-20 py-1.5 text-[10px] text-slate-500">{dayLabel(e.day)}</td>
                  <td className="py-1.5 text-[11px]">
                    {e.label}
                    <span className="ms-1.5 text-[10px] text-slate-500">{EXPENSE_LABEL[e.category]}</span>
                  </td>
                  <td className={cn(td, 'text-end text-rose-600')}>−{dh(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      <footer className="mt-8 border-t border-slate-200 pt-2 text-[9px] text-slate-400">
        Orders are counted on the day they were placed (Morocco time). Profit is counted once an order is delivered; parcels sent back count their delivery cost.
      </footer>
    </article>
  )
}

/**
 * Printable profit report (A4) for the chosen period — opened from Admin → Profit. "Download PDF"
 * uses the browser's print dialog (Save as PDF).
 */
export function ProfitReport() {
  const [params, setParams] = useSearchParams()
  const raw = Number(params.get('days'))
  const range = (RANGES.some((x) => x.value === raw) ? raw : 30) as SalesRange

  const report = useQuery({
    queryKey: ['admin-profit', range],
    queryFn: async () => (await adminApi.profit.report(range)).data.data,
    staleTime: 30_000,
  })
  const r = report.data

  useEffect(() => {
    const prev = document.title
    if (r) document.title = `Brynoxa profit report ${r.from} to ${r.to}`
    return () => {
      document.title = prev
    }
  }, [r])

  return (
    <div className="min-h-dvh bg-slate-200 p-4 print:bg-white print:p-0">
      <style>{'@page { size: A4; margin: 12mm 14mm } @media print { html, body { background: #fff !important } }'}</style>
      <div className="mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex flex-wrap gap-1 rounded-full bg-white p-1 shadow-sm">
          {RANGES.map((x) => (
            <button
              key={x.value}
              type="button"
              onClick={() => setParams({ days: String(x.value) }, { replace: true })}
              className={cn('h-8 rounded-full px-3 text-xs font-medium', range === x.value ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900')}
            >
              {x.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-600 max-sm:hidden">In the print window choose “Save as PDF”</span>
          <Button size="sm" onClick={() => window.print()} disabled={!r}>
            Download PDF
          </Button>
        </div>
      </div>

      {report.isError ? (
        <p className="mx-auto max-w-[210mm] rounded-xl bg-white p-6 text-sm text-rose-600">Could not load the report. Refresh the page to try again.</p>
      ) : !r ? (
        <div className="grid place-items-center py-24">
          <Spinner />
        </div>
      ) : (
        <div className={cn(report.isFetching && 'opacity-60')}>
          <ReportBody r={r} />
        </div>
      )}
    </div>
  )
}
