import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { inventoryApi } from '@/api/inventoryApi'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { Spinner } from '@/components/ui/Spinner'
import { formatCurrency, formatDate } from '@/lib/format'
import type { ReceiptLine } from '@/types'
import { byName, invCard } from './MovementLabels'

export function ReceiveResultText({ line }: { line: ReceiptLine }) {
  const r = line.result
  const parts = [
    r.available ? `${r.available} sellable` : '',
    r.defective ? `${r.defective} defective` : '',
    r.underRepair ? `${r.underRepair} to repair` : '',
    r.awaitingInspection ? `${r.awaitingInspection} to inspect` : '',
  ].filter(Boolean)
  return <span className="text-xs text-[var(--fg-muted)]">{parts.join(' · ') || '—'}</span>
}

/** Recent supplier deliveries with a supplier filter. */
export function ReceiveHistory() {
  const [page, setPage] = useState(1)
  const [text, setText] = useState('')
  const [supplier, setSupplier] = useState('')

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSupplier(text.trim())
      setPage(1)
    }, 350)
    return () => window.clearTimeout(t)
  }, [text])

  const receipts = useQuery({
    queryKey: ['admin-inventory', 'receipts', { page, supplier }],
    queryFn: async () => {
      const res = await inventoryApi.receipts({ page, limit: 10, supplier })
      return { items: res.data.data, meta: res.data.meta }
    },
    placeholderData: keepPreviousData,
  })

  const items = receipts.data?.items ?? []

  return (
    <section className={`${invCard} space-y-3 p-3 sm:p-5`}>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="font-semibold">Recent deliveries</h2>
        <div className="sm:w-64">
          <Input type="search" aria-label="Filter by supplier" placeholder="Filter by supplier" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
      </div>

      {receipts.isPending ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : receipts.isError ? (
        <QueryErrorState onRetry={() => receipts.refetch()} />
      ) : !items.length ? (
        <p className="py-6 text-center text-sm text-[var(--fg-muted)]">No deliveries yet.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((r) => {
            const total = r.lines.reduce((s, l) => s + (l.unitCost ?? 0) * l.qty, 0)
            return (
              <li key={r._id} className="min-w-0 rounded-lg border border-[var(--border)] p-3 text-sm">
                <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="min-w-0 break-words font-medium">
                    {r.supplier}
                    {r.reference ? <span className="font-normal text-[var(--fg-muted)]"> · {r.reference}</span> : null}
                  </p>
                  <p className="text-xs text-[var(--fg-muted)]">
                    {formatDate(r.receivedAt)} · {byName(r.by)}
                    {total > 0 ? ` · ${formatCurrency(total)}` : ''}
                  </p>
                </div>
                <ul className="mt-2 space-y-1">
                  {r.lines.map((l, i) => (
                    <li key={l._id ?? i} className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                      <Link to={`/admin/inventory/products/${l.product}`} className="min-w-0 truncate hover:text-[var(--brand-text)]">
                        {l.qty} × {l.name}
                      </Link>
                      <ReceiveResultText line={l} />
                    </li>
                  ))}
                </ul>
                {r.location ? <p className="mt-1 text-xs text-[var(--fg-muted)]">Location: {r.location}</p> : null}
              </li>
            )
          })}
        </ul>
      )}
      <Pagination page={page} pages={receipts.data?.meta?.pages || 1} onChange={setPage} />
    </section>
  )
}
