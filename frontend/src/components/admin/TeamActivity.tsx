import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ACTIVITY_PERIODS, teamActivityApi, timeAgo } from '@/api/teamActivityApi'
import { Panel } from '@/components/admin/Panel'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { STAFF_ROLE_LABELS, type StaffRole } from '@/lib/permissions'
import { cn } from '@/lib/cn'

/** Period picker shared by the team panel and a staff member's page. */
export function PeriodPicker({ value, onChange }: { value: number; onChange: (days: number) => void }) {
  return (
    <div className="inline-flex rounded-full border border-[var(--border)] p-0.5 text-xs">
      {ACTIVITY_PERIODS.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          aria-pressed={value === d}
          className={cn(
            'rounded-full px-2.5 py-1 font-medium transition',
            value === d ? 'bg-[var(--brand)] text-[var(--brand-fg)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
          )}
        >
          {d === 365 ? '1 year' : `${d} days`}
        </button>
      ))}
    </div>
  )
}

const stat = (n: number, label: string) => (
  <span className="whitespace-nowrap">
    <span className="font-semibold tabular-nums text-[var(--fg)]">{n}</span> {label}
  </span>
)

/** Admin → Roles: what each staff member did in the period; click one for the full history. */
export function TeamActivity() {
  const [days, setDays] = useState(7)
  const team = useQuery({
    queryKey: ['team-activity', days],
    queryFn: async () => (await teamActivityApi.team(days)).data.data,
  })
  const staff = team.data?.staff ?? []

  return (
    <Panel
      title="Team activity"
      description="What each staff member did: orders handled, calls, changes and sign-ins. Click someone for their full history and unfinished orders."
      actions={<PeriodPicker value={days} onChange={setDays} />}
    >
      {team.isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : team.isError ? (
        <QueryErrorState onRetry={() => team.refetch()} />
      ) : (
        <ul className="-my-1 divide-y divide-[var(--border)]">
          {staff.map((s) => {
            const idle = !s.orderSteps && !s.changes && !s.calls
            return (
              <li key={s._id}>
                <Link to={`/admin/roles/${s._id}`} className="flex min-w-0 items-center gap-3 py-2.5 hover:text-[var(--brand-text)]">
                  <div className="min-w-0 flex-1">
                    <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <span className="truncate">{s.name || s.email}</span>
                      <span className="shrink-0 rounded-full bg-[var(--bg-muted)] px-1.5 py-px text-[10px] font-normal text-[var(--fg-muted)]">
                        {s.role === 'admin' ? 'Owner' : (STAFF_ROLE_LABELS[s.role as StaffRole] ?? s.role)}
                      </span>
                      {!s.isActive ? <span className="shrink-0 text-[10px] text-[var(--danger)]">disabled</span> : null}
                    </p>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--fg-muted)]">
                      {idle ? (
                        <span>No work in this period</span>
                      ) : (
                        <>
                          {s.orderSteps ? stat(s.orderSteps, 'order steps') : null}
                          {s.delivered ? stat(s.delivered, 'delivered') : null}
                          {s.calls ? stat(s.calls, 'calls') : null}
                          {s.ordersAdded ? stat(s.ordersAdded, 'orders added') : null}
                          {s.changes ? stat(s.changes, 'other changes') : null}
                        </>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 text-end text-[11px] text-[var(--fg-muted)]">
                    Last active
                    <span className="block text-xs font-medium text-[var(--fg)]">{timeAgo(s.lastActive)}</span>
                  </span>
                  <SiteIcon name="chevron-right" size={15} className="shrink-0 text-[var(--fg-muted)] rtl:rotate-180" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
