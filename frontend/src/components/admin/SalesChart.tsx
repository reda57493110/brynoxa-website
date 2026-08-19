import { formatCurrency } from '@/lib/format'

export function SalesChart({
  data,
}: {
  data: { _id: string; revenue: number; orders: number }[]
}) {
  const max = Math.max(1, ...data.map((d) => d.revenue))

  return (
    <div className="flex h-44 items-end gap-1.5">
      {data.map((d) => {
        const h = Math.max(4, Math.round((d.revenue / max) * 100))
        return (
          <div key={d._id} className="group flex min-w-0 flex-1 flex-col items-center justify-end">
            <div
              className="w-full rounded-t-md bg-[var(--brand)]/80 transition group-hover:bg-[var(--brand)]"
              style={{ height: `${h}%` }}
              title={`${d._id}: ${formatCurrency(d.revenue)} · ${d.orders} orders`}
            />
            <span className="mt-1 hidden text-[9px] text-[var(--fg-muted)] sm:block">
              {d._id.slice(5)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
