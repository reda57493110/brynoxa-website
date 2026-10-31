import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { formatCurrency } from '@/lib/format'
import type { CustomerListParams } from '@/types'

/** Columns kept on paper (the spreadsheet has them all); widths fit a landscape A4 page. */
const PRINTED = ['Customer ID', 'Name', 'Phone', 'Email', 'Type', 'Status', 'Registered', 'Orders', 'Amount paid', 'Net sales', 'Last order', 'To collect', 'Gross profit']

function shown(value: unknown, type?: string) {
  if (value === null || value === undefined || value === '') return '—'
  if ((type === 'money' || type === 'number') && typeof value === 'number') return type === 'money' ? formatCurrency(value) : String(value)
  if (type === 'percent' && typeof value === 'number') return `${value} %`
  if (type === 'date') return String(value).slice(0, 10)
  return String(value)
}

const FILTER_LABEL: Record<string, string> = {
  q: 'Search',
  segment: 'Segment',
  type: 'Type',
  status: 'Status',
  source: 'Source',
  from: 'Orders from',
  to: 'Orders to',
  registeredFrom: 'Registered from',
  registeredTo: 'Registered to',
  activity: 'Activity',
}

/**
 * Customers → Export → PDF / print: the filtered customer list as a clean table on paper (or
 * "Save as PDF" in the print window). Opened in a new tab with the list's filters in the address.
 */
export function CustomersPrint() {
  const [params] = useSearchParams()
  const filters = Object.fromEntries([...params.entries()].filter(([, v]) => v)) as CustomerListParams
  const table = useQuery({
    queryKey: ['admin-customers-print', params.toString()],
    queryFn: async () => (await adminApi.customers.exportTable(filters)).data.data,
  })

  useEffect(() => {
    if (!table.data) return
    const id = window.setTimeout(() => window.print(), 600)
    return () => window.clearTimeout(id)
  }, [table.data])

  const columns = (table.data?.columns ?? [])
    .map((c, i) => ({ ...c, i }))
    .filter((c) => PRINTED.includes(c.header))
  const active = Object.entries(filters).filter(([k]) => FILTER_LABEL[k])

  return (
    <div className="min-h-dvh bg-[var(--bg-muted)] px-2 py-3 sm:p-6 print:bg-white print:p-0">
      <style>{'@page { size: A4 landscape; margin: 10mm } @media print { thead { display: table-header-group } tr { break-inside: avoid } }'}</style>
      <div className="mx-auto mb-3 flex max-w-6xl flex-wrap items-center justify-between gap-2 px-1 print:hidden">
        <Link to="/admin/customers" className="text-sm text-[var(--brand-text)] hover:underline">
          ← Back to customers
        </Link>
        <Button size="sm" onClick={() => window.print()} disabled={!table.data}>
          Print / Save as PDF
        </Button>
      </div>

      {table.isPending ? (
        <div className="flex justify-center py-24">
          <Spinner size="lg" />
        </div>
      ) : table.isError ? (
        <QueryErrorState onRetry={() => table.refetch()} />
      ) : (
        <article className="mx-auto max-w-6xl overflow-x-auto bg-white p-4 text-black shadow-sm sm:p-8 print:max-w-none print:overflow-visible print:p-0 print:shadow-none">
          <header className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b-2 border-black pb-3">
            <div className="flex items-center gap-2">
              <img src="/brand/brynoxa-mark.png" alt="" className="size-9 rounded-md bg-[#080B0E]" />
              <div>
                <h1 className="text-lg font-bold leading-tight text-black">Customers</h1>
                <p className="text-xs text-black/60">Brynoxa · {new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              </div>
            </div>
            <div className="text-end text-xs">
              <p className="font-semibold">
                {table.data.rows.length} customer{table.data.rows.length === 1 ? '' : 's'}
              </p>
              {active.length ? (
                <p className="text-black/60">{active.map(([k, v]) => `${FILTER_LABEL[k]}: ${v}`).join(' · ')}</p>
              ) : (
                <p className="text-black/60">All customers · lifetime figures</p>
              )}
            </div>
          </header>

          {table.data.rows.length ? (
            <table className="w-full border-collapse text-[11px] leading-snug">
              <thead>
                <tr className="border-b border-black text-start">
                  {columns.map((c) => (
                    <th
                      key={c.header}
                      className={`whitespace-nowrap px-1.5 py-1.5 font-semibold ${c.type === 'money' || c.type === 'number' ? 'text-end' : 'text-start'}`}
                    >
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.data.rows.map((row, r) => (
                  <tr key={r} className="border-b border-black/10 align-top odd:bg-black/[0.03]">
                    {columns.map((c) => (
                      <td
                        key={c.header}
                        className={`px-1.5 py-1 ${c.type === 'money' || c.type === 'number' ? 'whitespace-nowrap text-end tabular-nums' : c.header === 'Email' ? 'break-all' : ''} ${c.header === 'Name' ? 'font-medium' : ''}`}
                        dir={c.header === 'Phone' || c.header === 'Email' ? 'ltr' : undefined}
                      >
                        {shown(row[c.i], c.type)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-10 text-center text-sm text-black/60">No customers match these filters.</p>
          )}
          <p className="mt-3 text-[10px] text-black/50">
            Amounts in DH. Every column (wholesale tier, average order, first order, margin…) is in the Excel export.
          </p>
        </article>
      )}
    </div>
  )
}
