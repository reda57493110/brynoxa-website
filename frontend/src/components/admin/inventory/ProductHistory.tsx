import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { cardClass } from '@/components/admin/customers/shared'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { InventoryStatusDef, ProductInventoryDetail, RepairStatus, ReturnOutcome, StockMovement } from '@/types'
import { MOVEMENT_LABELS, bucketLabel } from './ProductLabels'

type Tab = 'units' | 'deliveries' | 'returns' | 'repairs' | 'log'

const REPAIR_STATUS: Record<RepairStatus, { label: string; variant: BadgeVariant }> = {
  'awaiting-diagnosis': { label: 'Awaiting diagnosis', variant: 'warning' },
  'awaiting-parts': { label: 'Awaiting parts', variant: 'warning' },
  'in-repair': { label: 'In repair', variant: 'brand' },
  'repair-completed': { label: 'Repaired', variant: 'brand' },
  'qc-pending': { label: 'QC pending', variant: 'warning' },
  'qc-passed': { label: 'QC passed', variant: 'success' },
  'qc-failed': { label: 'QC failed', variant: 'danger' },
}

const OUTCOME_LABELS: Record<ReturnOutcome, string> = {
  'restock-new': 'Restocked new',
  used: 'To used',
  repair: 'To repair',
  defective: 'Defective',
  'write-off': 'Written off',
}

function Table({ head, children, minW = 'min-w-[720px]' }: { head: string[]; children: ReactNode; minW?: string }) {
  return (
    <div className={cn(cardClass, 'min-w-0 overflow-x-auto')}>
      <table className={cn('w-full text-left text-sm', minW)}>
        <thead className="bg-[var(--bg-muted)] text-xs text-[var(--fg-muted)]">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2.5 font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

const td = 'px-3 py-2.5 align-top'

function Empty({ text }: { text: string }) {
  return <p className={cn(cardClass, 'px-4 py-8 text-center text-sm text-[var(--fg-muted)]')}>{text}</p>
}

function byName(by: StockMovement['by']) {
  if (!by) return '—'
  return typeof by === 'string' ? 'Staff' : by.name || 'Staff'
}

function MovementRef({ m }: { m: StockMovement }) {
  if (m.order) {
    return (
      <Link to={`/admin/orders/${m.order}`} className="text-[var(--brand-text)] hover:underline">
        Order #{m.orderNumber || m.order.slice(-6)}
      </Link>
    )
  }
  if (m.customerReturn) {
    return (
      <Link to={`/admin/inventory/returns/${m.customerReturn}`} className="text-[var(--brand-text)] hover:underline">
        Return
      </Link>
    )
  }
  if (m.repair) {
    return (
      <Link to={`/admin/inventory/repairs/${m.repair}`} className="text-[var(--brand-text)] hover:underline">
        Repair
      </Link>
    )
  }
  if (m.receipt) return <span>Delivery</span>
  return <span className="text-[var(--fg-muted)]">—</span>
}

export function ProductHistory({
  detail,
  statuses,
}: {
  detail: ProductInventoryDetail
  statuses: InventoryStatusDef[]
}) {
  const serial = detail.product.serialTracking
  const tabs: { id: Tab; label: string; n: number }[] = [
    ...(serial ? [{ id: 'units' as const, label: 'Units', n: detail.units.length }] : []),
    { id: 'deliveries', label: 'Deliveries', n: detail.receipts.length },
    { id: 'returns', label: 'Returns', n: detail.returns.length },
    { id: 'repairs', label: 'Repairs', n: detail.repairs.length },
    { id: 'log', label: 'Stock log', n: detail.movements.length },
  ]
  const [tab, setTab] = useState<Tab>(serial ? 'units' : 'log')
  const active = tabs.some((t) => t.id === tab) ? tab : 'log'
  const label = (b: string) => bucketLabel(b, statuses)

  return (
    <section className="min-w-0 space-y-3">
      <div
        role="tablist"
        className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'h-9 shrink-0 rounded-full border px-3 text-sm whitespace-nowrap',
              active === t.id
                ? 'border-transparent bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] text-[var(--brand-text)]'
                : 'border-[var(--border)]'
            )}
          >
            {t.label} <span className="text-[var(--fg-muted)]">{t.n}</span>
          </button>
        ))}
      </div>

      {active === 'units' ? (
        detail.units.length ? (
          <Table head={['Serial', 'Status', 'Cost', 'Location', 'Warranty', 'Added']}>
            {detail.units.map((u) => (
              <tr key={u._id} className="border-t border-[var(--border)]">
                <td className={cn(td, 'font-mono text-xs')}>{u.serial}</td>
                <td className={td}>
                  <Badge variant={u.status === 'available' ? 'success' : u.status === 'sold' ? 'muted' : 'warning'}>
                    {label(u.status)}
                  </Badge>
                </td>
                <td className={cn(td, 'whitespace-nowrap')}>
                  {u.unitCost !== undefined && u.unitCost !== null ? formatCurrency(u.unitCost) : '—'}
                </td>
                <td className={td}>{u.location || '—'}</td>
                <td className={td}>{u.warranty || '—'}</td>
                <td className={cn(td, 'whitespace-nowrap')}>{formatDate(u.createdAt)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty text="No serial numbers registered." />
        )
      ) : null}

      {active === 'deliveries' ? (
        detail.receipts.length ? (
          <Table head={['Date', 'Supplier', 'Ref', 'Qty', 'Unit cost', 'Result']}>
            {detail.receipts.map((r) => {
              const l = r.line
              return (
                <tr key={r._id} className="border-t border-[var(--border)]">
                  <td className={cn(td, 'whitespace-nowrap')}>{formatDate(r.receivedAt)}</td>
                  <td className={cn(td, 'font-medium')}>{r.supplier}</td>
                  <td className={td}>{r.reference || '—'}</td>
                  <td className={td}>{l?.qty ?? '—'}</td>
                  <td className={cn(td, 'whitespace-nowrap')}>
                    {l?.unitCost !== undefined && l?.unitCost !== null ? formatCurrency(l.unitCost) : '—'}
                  </td>
                  <td className={td}>
                    {l ? (
                      <div className="flex flex-wrap gap-1">
                        {l.result.available ? <Badge variant="success">{l.result.available} sellable</Badge> : null}
                        {l.result.awaitingInspection ? (
                          <Badge variant="warning">{l.result.awaitingInspection} to inspect</Badge>
                        ) : null}
                        {l.result.defective ? <Badge variant="danger">{l.result.defective} defective</Badge> : null}
                        {l.result.underRepair ? <Badge variant="brand">{l.result.underRepair} in repair</Badge> : null}
                      </div>
                    ) : (
                      '—'
                    )}
                    {l?.faultNotes ? <p className="mt-1 text-xs text-[var(--fg-muted)]">{l.faultNotes}</p> : null}
                  </td>
                </tr>
              )
            })}
          </Table>
        ) : (
          <Empty text="No deliveries recorded." />
        )
      ) : null}

      {active === 'returns' ? (
        detail.returns.length ? (
          <Table head={['Date', 'Order', 'Customer', 'Status', 'Qty', 'Reason', 'Outcome', '']}>
            {detail.returns.map((r) => {
              const l = r.line
              const customer = typeof r.customer === 'string' ? '—' : r.customer.name || r.customer.email || '—'
              return (
                <tr key={r._id} className="border-t border-[var(--border)]">
                  <td className={cn(td, 'whitespace-nowrap')}>{formatDate(r.returnedAt)}</td>
                  <td className={cn(td, 'whitespace-nowrap')}>
                    <Link to={`/admin/orders/${r.order}`} className="text-[var(--brand-text)] hover:underline">
                      #{r.orderNumber}
                    </Link>
                  </td>
                  <td className={cn(td, 'max-w-[10rem] truncate')}>{customer}</td>
                  <td className={td}>
                    <Badge variant={r.status === 'assessed' ? 'success' : 'warning'}>
                      {r.status === 'assessed' ? 'Assessed' : 'To assess'}
                    </Badge>
                  </td>
                  <td className={td}>{l?.qty ?? '—'}</td>
                  <td className={cn(td, 'max-w-[14rem]')}>{l?.reason || '—'}</td>
                  <td className={td}>
                    {l?.assessed.length ? (
                      <div className="flex flex-wrap gap-1">
                        {l.assessed.map((a, i) => (
                          <Badge key={i} variant="muted">
                            {a.qty} {OUTCOME_LABELS[a.outcome] ?? a.outcome}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={td}>
                    <Link to={`/admin/inventory/returns/${r._id}`} className="text-[var(--brand-text)] hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              )
            })}
          </Table>
        ) : (
          <Empty text="No customer returns." />
        )
      ) : null}

      {active === 'repairs' ? (
        detail.repairs.length ? (
          <Table head={['Opened', 'Status', 'Qty', 'Serial', 'Fault', 'Cost', '']}>
            {detail.repairs.map((r) => {
              const st = REPAIR_STATUS[r.status] ?? { label: r.status, variant: 'default' as BadgeVariant }
              return (
                <tr key={r._id} className="border-t border-[var(--border)]">
                  <td className={cn(td, 'whitespace-nowrap')}>{formatDate(r.createdAt)}</td>
                  <td className={td}>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </td>
                  <td className={td}>{r.qty}</td>
                  <td className={cn(td, 'font-mono text-xs')}>{r.serial || '—'}</td>
                  <td className={cn(td, 'max-w-[16rem]')}>{r.reportedFault}</td>
                  <td className={cn(td, 'whitespace-nowrap')}>{formatCurrency(r.cost || 0)}</td>
                  <td className={td}>
                    <Link to={`/admin/inventory/repairs/${r._id}`} className="text-[var(--brand-text)] hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              )
            })}
          </Table>
        ) : (
          <Empty text="No repairs." />
        )
      ) : null}

      {active === 'log' ? (
        detail.movements.length ? (
          <Table head={['Date', 'Type', 'Qty', 'From → To', 'Reason', 'Reference', 'By']} minW="min-w-[900px]">
            {detail.movements.map((m) => (
              <tr key={m._id} className="border-t border-[var(--border)]">
                <td className={cn(td, 'whitespace-nowrap')}>{formatDateTime(m.createdAt)}</td>
                <td className={cn(td, 'whitespace-nowrap font-medium')}>{MOVEMENT_LABELS[m.type] ?? m.type}</td>
                <td className={td}>{m.qty}</td>
                <td className={td}>
                  <span className="whitespace-nowrap">
                    {label(m.from)}
                    {m.fromAfter !== undefined && m.from !== 'external' ? (
                      <span className="text-[var(--fg-muted)]"> ({m.fromAfter})</span>
                    ) : null}
                  </span>
                  {' → '}
                  <span className="whitespace-nowrap">
                    {label(m.to)}
                    {m.toAfter !== undefined && m.to !== 'external' ? (
                      <span className="text-[var(--fg-muted)]"> ({m.toAfter})</span>
                    ) : null}
                  </span>
                  {m.serials.length ? (
                    <p className="mt-0.5 font-mono text-[11px] text-[var(--fg-muted)]">{m.serials.join(', ')}</p>
                  ) : null}
                </td>
                <td className={cn(td, 'max-w-[16rem]')}>{m.reason || '—'}</td>
                <td className={cn(td, 'whitespace-nowrap')}>
                  <MovementRef m={m} />
                </td>
                <td className={cn(td, 'whitespace-nowrap')}>{byName(m.by)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty text="No stock movements yet." />
        )
      ) : null}
    </section>
  )
}
