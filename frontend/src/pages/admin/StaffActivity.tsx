import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { teamActivityApi, timeAgo } from '@/api/teamActivityApi'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { Panel } from '@/components/admin/Panel'
import { PeriodPicker } from '@/components/admin/TeamActivity'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import { STAFF_ROLE_LABELS, type StaffRole } from '@/lib/permissions'
import { cn } from '@/lib/cn'

const KIND_ICON: Record<string, Parameters<typeof SiteIcon>[0]['name']> = {
  'order-status': 'package',
  'order-contact': 'phone',
  order: 'package',
  product: 'boxes',
  catalog: 'layers',
  inventory: 'warehouse',
  customer: 'user',
  marketing: 'ticket',
  message: 'mail',
  money: 'banknote',
  settings: 'settings',
  staff: 'shield',
  'sign-in': 'user',
  other: 'pencil',
}

function Figure({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5">
      <p className="text-[11px] text-[var(--fg-muted)]">{label}</p>
      <p className="font-display text-lg font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-[11px] text-[var(--fg-muted)]">{hint}</p> : null}
    </div>
  )
}

/** Admin → Roles → one staff member: their figures, unfinished orders and full history. */
export function StaffActivity() {
  const { id = '' } = useParams()
  const [days, setDays] = useState(30)
  const [kind, setKind] = useState('')
  const q = useQuery({
    queryKey: ['team-activity', id, days],
    queryFn: async () => (await teamActivityApi.member(id, days)).data.data,
  })

  if (q.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    )
  }
  if (q.isError || !q.data) return <QueryErrorState onRetry={() => q.refetch()} />

  const { member, summary: s, handled, unfinished, feed } = q.data
  const role = member.role === 'admin' ? 'Owner' : (STAFF_ROLE_LABELS[member.role as StaffRole] ?? member.role)
  const kinds = [...new Set(feed.map((f) => f.kind))]
  const shown = kind ? feed.filter((f) => f.kind === kind || (kind === 'orders' && f.kind.startsWith('order'))) : feed
  const period = days === 365 ? 'the last year' : `the last ${days} days`

  return (
    <div className="min-w-0 space-y-4">
      <Link to="/admin/roles" className="inline-flex items-center gap-1 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <SiteIcon name="chevron-left" size={14} className="rtl:rotate-180" /> Roles
      </Link>
      <AdminHeader
        title={member.name || member.email}
        description={`${role} · ${member.email} · on the team since ${formatDate(member.since)}${member.isActive ? '' : ' · disabled'}`}
        actions={<PeriodPicker value={days} onChange={setDays} />}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Figure label="Last active" value={timeAgo(s.lastActive)} hint={`${s.activeDays} active day${s.activeDays === 1 ? '' : 's'}`} />
        <Figure label="Order steps" value={s.orderSteps} hint={`${s.confirmed} confirmed · ${s.shipped} shipped`} />
        <Figure label="Delivered" value={s.delivered} hint={s.cancelled ? `${s.cancelled} cancelled` : undefined} />
        <Figure label="Calls / messages" value={s.calls} />
        <Figure label="Orders added" value={s.ordersAdded} hint="Social media, phone, shop" />
        <Figure label="Other changes" value={s.changes} hint={`${s.signIns} sign-in${s.signIns === 1 ? '' : 's'}`} />
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-start">
        <div className="min-w-0 space-y-4">
          <Panel
            title="Did they finish the job?"
            description={`Orders they confirmed or added in ${period}, and where those orders are now.`}
          >
            {handled.total ? (
              <>
                <div className="flex h-2.5 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                  {[
                    { n: handled.done, c: 'bg-[var(--success)]' },
                    { n: handled.open, c: 'bg-[var(--brand)]' },
                    { n: handled.returned, c: 'bg-[var(--warning)]' },
                    { n: handled.cancelled, c: 'bg-[var(--fg-muted)]' },
                  ].map((p, i) => (p.n ? <span key={i} className={p.c} style={{ width: `${(p.n / handled.total) * 100}%` }} /> : null))}
                </div>
                <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <li><span className="me-1.5 inline-block h-2 w-2 rounded-full bg-[var(--success)]" />{handled.done} delivered</li>
                  <li><span className="me-1.5 inline-block h-2 w-2 rounded-full bg-[var(--brand)]" />{handled.open} still in progress</li>
                  <li><span className="me-1.5 inline-block h-2 w-2 rounded-full bg-[var(--warning)]" />{handled.returned} returned</li>
                  <li><span className="me-1.5 inline-block h-2 w-2 rounded-full bg-[var(--fg-muted)]" />{handled.cancelled} cancelled</li>
                </ul>
                {handled.finishedRate !== null ? (
                  <p className="mt-2 text-xs text-[var(--fg-muted)]">{handled.finishedRate}% of their {handled.total} orders are finished.</p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-[var(--fg-muted)]">No orders confirmed or added by them in {period}.</p>
            )}
          </Panel>

          <Panel title={`Unfinished orders · ${unfinished.length}`} description="Their orders that are not delivered, returned or cancelled yet. Orange: no change for 2 days.">
            {unfinished.length ? (
              <ul className="-my-1 divide-y divide-[var(--border)]">
                {unfinished.map((o) => (
                  <li key={o._id}>
                    <Link to={`/admin/orders/${o._id}`} className="flex items-center gap-3 py-2 text-sm hover:text-[var(--brand-text)]">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">#{o.orderNumber}</span>
                        <span className="block truncate text-xs text-[var(--fg-muted)]">{o.customer} · {formatCurrency(o.total)}</span>
                      </span>
                      <span className={cn('shrink-0 text-end text-xs', o.stuck ? 'text-[var(--warning)]' : 'text-[var(--fg-muted)]')}>
                        {o.statusLabel}
                        <span className="block">{timeAgo(o.since)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--fg-muted)]">Nothing left open.</p>
            )}
          </Panel>
        </div>

        <Panel
          title={`History · ${shown.length}`}
          description={`Everything they did in ${period}, newest first.`}
          actions={
            kinds.length > 1 ? (
              <select
                aria-label="Show"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className="h-8 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2 text-xs"
              >
                <option value="">Everything</option>
                <option value="orders">Orders and calls</option>
                {kinds.filter((k) => !k.startsWith('order')).map((k) => (
                  <option key={k} value={k}>
                    {k === 'sign-in' ? 'Sign-ins' : k.charAt(0).toUpperCase() + k.slice(1)}
                  </option>
                ))}
              </select>
            ) : undefined
          }
        >
          {shown.length ? (
            <ol className="-my-1 divide-y divide-[var(--border)]">
              {shown.map((f, i) => {
                const body = (
                  <>
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[var(--brand-text)]">
                      <SiteIcon name={KIND_ICON[f.kind] ?? 'pencil'} size={13} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm">{f.action}</span>
                      {f.detail ? <span className="block truncate text-xs text-[var(--fg-muted)]">{f.detail}</span> : null}
                    </span>
                    <span className="shrink-0 text-end text-[11px] text-[var(--fg-muted)]" title={formatDateTime(f.at)}>
                      {timeAgo(f.at)}
                    </span>
                  </>
                )
                return (
                  <li key={`${f.at}-${i}`}>
                    {f.link ? (
                      <Link to={f.link} className="flex items-start gap-2.5 py-2 hover:text-[var(--brand-text)]">
                        {body}
                      </Link>
                    ) : (
                      <div className="flex items-start gap-2.5 py-2">{body}</div>
                    )}
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="text-sm text-[var(--fg-muted)]">Nothing recorded in {period}.</p>
          )}
        </Panel>
      </div>
    </div>
  )
}
