import { Section, KV, cardClass } from '@/components/admin/customers/shared'
import { formatCurrency, formatDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { InventorySummary } from '@/types'
import { pctText } from './ProductLabels'

const CONDITIONS = [
  { key: 'new', label: 'New' },
  { key: 'refurbished', label: 'Refurbished' },
  { key: 'used', label: 'Used' },
]

function Uncosted({ n }: { n: number }) {
  if (n <= 0) return null
  return <span className="ml-1 text-[11px] text-[var(--warning)]">(+{n} no cost)</span>
}

export function DashboardReports({ summary }: { summary: InventorySummary }) {
  const { value, reports } = summary
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Section title="Value by condition">
          <dl className="divide-y divide-[var(--border)]">
            {CONDITIONS.map((c) => {
              const row = value.byCondition[c.key] ?? { units: 0, value: 0, uncostedUnits: 0 }
              return (
                <KV key={c.key} label={c.label}>
                  <span className="text-[var(--fg-muted)]">{row.units} u · </span>
                  {formatCurrency(row.value)}
                  <Uncosted n={row.uncostedUnits} />
                </KV>
              )
            })}
            <KV label="Defective">{formatCurrency(value.defective)}</KV>
          </dl>
        </Section>
        <Section title="Repairs">
          <dl className="divide-y divide-[var(--border)]">
            <KV label="Open">{reports.repairs.open}</KV>
            <KV label="Closed">{reports.repairs.closed}</KV>
            <KV label="Success">{pctText(reports.repairs.successRate)}</KV>
            <KV label="Cost">{formatCurrency(reports.repairs.cost)}</KV>
          </dl>
        </Section>
        <Section title="Write-offs">
          <dl className="divide-y divide-[var(--border)]">
            <KV label="Units">{reports.writeOffs.units}</KV>
            <KV label="Value">
              {formatCurrency(reports.writeOffs.value)}
              <Uncosted n={reports.writeOffs.uncostedUnits} />
            </KV>
          </dl>
        </Section>
        <Section title="Customer returns">
          <dl>
            <KV label="Units returned">{reports.customerReturns.units}</KV>
          </dl>
        </Section>
      </div>

      <Section title="Suppliers">
        {reports.suppliers.length ? (
          <div className={cn(cardClass, 'min-w-0 overflow-x-auto')}>
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-[var(--bg-muted)] text-xs text-[var(--fg-muted)]">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Supplier</th>
                  <th className="px-3 py-2.5 text-right font-medium">Deliveries</th>
                  <th className="px-3 py-2.5 text-right font-medium">Units</th>
                  <th className="px-3 py-2.5 text-right font-medium">Faulty</th>
                  <th className="px-3 py-2.5 text-right font-medium">Defect rate</th>
                  <th className="px-3 py-2.5 font-medium">Last delivery</th>
                </tr>
              </thead>
              <tbody>
                {reports.suppliers.map((s) => (
                  <tr key={s.supplier} className="border-t border-[var(--border)]">
                    <td className="max-w-[14rem] truncate px-3 py-2.5 font-medium">{s.supplier}</td>
                    <td className="px-3 py-2.5 text-right">{s.deliveries}</td>
                    <td className="px-3 py-2.5 text-right">{s.units}</td>
                    <td className="px-3 py-2.5 text-right">{s.faulty}</td>
                    <td
                      className={cn(
                        'px-3 py-2.5 text-right',
                        (s.defectRate ?? 0) >= 10 && 'font-semibold text-[var(--danger)]'
                      )}
                    >
                      {pctText(s.defectRate)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{s.lastDelivery ? formatDate(s.lastDelivery) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[var(--fg-muted)]">No deliveries yet.</p>
        )}
      </Section>
    </div>
  )
}
