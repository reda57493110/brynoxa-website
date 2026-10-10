import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { inventoryApi } from '@/api/inventoryApi'
import { AdminHeader } from '@/components/admin/AdminHeader'
import {
  FINAL_STATUS_LABELS,
  REPAIR_SOURCE_LABELS,
  REPAIR_STATUS_LABELS,
  byName,
  invCard,
  repairStatusVariant,
} from '@/components/admin/inventory/MovementLabels'
import { RepairQcForm } from '@/components/admin/inventory/RepairQcForm'
import { RepairWorkForm } from '@/components/admin/inventory/RepairWorkForm'
import { Badge } from '@/components/ui/Badge'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { Spinner } from '@/components/ui/Spinner'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'

export function InventoryRepair() {
  const { id = '' } = useParams()
  const repair = useQuery({
    queryKey: ['admin-inventory', 'repair', id],
    queryFn: async () => (await inventoryApi.repair(id)).data.data,
    enabled: Boolean(id),
  })

  if (repair.isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    )
  }
  if (repair.isError) return <QueryErrorState title="Could not load this repair" onRetry={() => repair.refetch()} />
  const r = repair.data
  const final = typeof r.finalProduct === 'object' ? r.finalProduct : null
  const qcOpen = !r.closed && (r.status === 'repair-completed' || r.status === 'qc-pending')

  const facts: { label: string; value: ReactNode }[] = [
    { label: 'Serial', value: r.serial ? <span className="font-mono text-xs">{r.serial}</span> : '—' },
    { label: 'Qty', value: r.qty },
    {
      label: 'Source',
      value: (
        <>
          {REPAIR_SOURCE_LABELS[r.source]}
          {r.customerReturn ? (
            <>
              {' · '}
              <Link to={`/admin/inventory/returns/${r.customerReturn}`} className="text-[var(--brand-text)] hover:underline">
                view return
              </Link>
            </>
          ) : null}
        </>
      ),
    },
    { label: 'Opened', value: formatDate(r.createdAt) },
    { label: 'Technician', value: r.technician || '—' },
    { label: 'Repair cost', value: formatCurrency(r.cost || 0) },
  ]

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <Link to="/admin/inventory/repairs" className="inline-flex items-center gap-1 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <SiteIcon name="arrow-left" size={14} /> Repairs
      </Link>
      <AdminHeader
        title={r.name}
        description={r.sku}
        actions={
          <>
            <Badge variant={repairStatusVariant(r.status)}>{REPAIR_STATUS_LABELS[r.status]}</Badge>
            <Badge variant={r.closed ? 'muted' : 'brand'}>{r.closed ? 'Closed' : 'Open'}</Badge>
          </>
        }
      />

      <section className={`${invCard} space-y-3 p-3 sm:p-5`}>
        <Link to={`/admin/inventory/products/${r.product}`} className="inline-flex items-center gap-1 text-sm text-[var(--brand-text)] hover:underline">
          <SiteIcon name="warehouse" size={14} /> Product stock
        </Link>
        <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-xs text-[var(--fg-muted)]">{f.label}</dt>
              <dd className="break-words">{f.value}</dd>
            </div>
          ))}
        </dl>
        <div className="text-sm">
          <p className="text-xs text-[var(--fg-muted)]">Reported fault</p>
          <p className="break-words">{r.reportedFault}</p>
        </div>
        {r.diagnosis ? (
          <div className="text-sm">
            <p className="text-xs text-[var(--fg-muted)]">Diagnosis</p>
            <p className="break-words">{r.diagnosis}</p>
          </div>
        ) : null}
        {r.partsReplaced.length ? (
          <div className="text-sm">
            <p className="text-xs text-[var(--fg-muted)]">Parts replaced</p>
            <p className="break-words">{r.partsReplaced.join(', ')}</p>
          </div>
        ) : null}
        {r.closed ? (
          <div className="rounded-lg bg-[var(--bg-muted)] px-3 py-2 text-sm">
            <p>
              QC <strong>{r.qcResult === 'passed' ? 'passed' : 'failed'}</strong>
              {r.finalStatus ? ` → ${FINAL_STATUS_LABELS[r.finalStatus]}` : ''}
              {final ? (
                <>
                  {' · '}
                  <Link to={`/admin/inventory/products/${final._id}`} className="text-[var(--brand-text)] hover:underline">
                    {final.name}
                  </Link>
                </>
              ) : null}
            </p>
            <p className="text-xs text-[var(--fg-muted)]">
              {r.completedAt ? formatDateTime(r.completedAt) : ''} · {byName(r.qcBy)}
              {r.qcNote ? ` · ${r.qcNote}` : ''}
            </p>
          </div>
        ) : null}
      </section>

      {!r.closed ? (
        <>
          <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--fg-muted)]">
            A repaired unit only becomes sellable after passing QC with approval. Its repair cost is added to the unit's value.
          </p>
          <section className={`${invCard} p-3 sm:p-5`}>
            <RepairWorkForm key={r.updatedAt} repair={r} />
          </section>
          {qcOpen ? (
            <section className={`${invCard} p-3 sm:p-5`}>
              <RepairQcForm repair={r} />
            </section>
          ) : (
            <p className="text-xs text-[var(--fg-muted)]">Set the status to "Repair completed" to run the quality check.</p>
          )}
        </>
      ) : null}

      <section className={`${invCard} p-3 sm:p-5`}>
        <h2 className="font-semibold">History</h2>
        <ol className="mt-3 space-y-3 border-l border-[var(--border)] pl-4">
          {[...r.history].reverse().map((h, i) => (
            <li key={`${h.at}-${i}`} className="relative text-sm">
              <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--brand)]" aria-hidden />
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={repairStatusVariant(h.status)}>{REPAIR_STATUS_LABELS[h.status] ?? h.status}</Badge>
                <span className="text-xs text-[var(--fg-muted)]">
                  {formatDateTime(h.at)} · {byName(h.by)}
                </span>
              </div>
              {h.note ? <p className="mt-0.5 break-words text-[var(--fg-muted)]">{h.note}</p> : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
