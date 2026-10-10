import { Link } from 'react-router-dom'
import type { StockMovement } from '@/types'
import { bucketLabel } from './MovementLabels'

export function MovementRefs({ m }: { m: StockMovement }) {
  const refs = [
    m.order ? (
      <Link key="o" to={`/admin/orders/${m.order}`} className="text-[var(--brand-text)] hover:underline">
        Order #{m.orderNumber || '…'}
      </Link>
    ) : null,
    m.receipt ? (
      <Link key="d" to="/admin/inventory/receive" className="text-[var(--brand-text)] hover:underline">
        Delivery
      </Link>
    ) : null,
    m.customerReturn ? (
      <Link key="r" to={`/admin/inventory/returns/${m.customerReturn}`} className="text-[var(--brand-text)] hover:underline">
        Return
      </Link>
    ) : null,
    m.repair ? (
      <Link key="p" to={`/admin/inventory/repairs/${m.repair}`} className="text-[var(--brand-text)] hover:underline">
        Repair
      </Link>
    ) : null,
  ].filter(Boolean)
  if (!refs.length) return <span className="text-[var(--fg-muted)]">—</span>
  return <span className="inline-flex flex-wrap gap-x-2">{refs}</span>
}

export function MovementFlow({ m }: { m: StockMovement }) {
  return (
    <span>
      {bucketLabel(m.from)}
      {m.fromAfter !== undefined && m.from !== 'external' ? <span className="text-[var(--fg-muted)]"> ({m.fromAfter})</span> : null}
      {' → '}
      {bucketLabel(m.to)}
      {m.toAfter !== undefined && m.to !== 'external' ? <span className="text-[var(--fg-muted)]"> ({m.toAfter})</span> : null}
    </span>
  )
}

