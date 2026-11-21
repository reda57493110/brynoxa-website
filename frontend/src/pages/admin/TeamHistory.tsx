import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { teamActivityApi, ACTIVITY_PERIODS, type TeamHistoryItem, type TeamHistoryOrder } from '@/api/teamActivityApi'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { orderStatusLabel, orderStatusVariant } from '@/lib/orderStatus'
import { cn } from '@/lib/cn'
import { useAdminT } from '@/store/adminLangStore'
import type { AdminKey } from '@/i18n/admin'

const KIND_ICON: Record<string, SiteIconName> = {
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

/** The type filter: which kinds of lines each choice shows */
const TYPES: { id: string; key: AdminKey; kinds?: string[] }[] = [
  { id: 'all', key: 'hist.typeAll' },
  { id: 'orders', key: 'hist.typeOrders', kinds: ['order-status', 'order'] },
  { id: 'calls', key: 'hist.typeCalls', kinds: ['order-contact'] },
  { id: 'catalog', key: 'hist.typeCatalog', kinds: ['product', 'catalog', 'inventory'] },
  { id: 'customers', key: 'hist.typeCustomers', kinds: ['customer', 'message'] },
  { id: 'money', key: 'hist.typeMoney', kinds: ['money', 'marketing'] },
  { id: 'settings', key: 'hist.typeSettings', kinds: ['settings', 'staff', 'other'] },
  { id: 'signin', key: 'hist.typeSignIn', kinds: ['sign-in'] },
]

const OUTCOMES = [
  { id: 'all', key: 'hist.outAll' },
  { id: 'open', key: 'hist.outOpen' },
  { id: 'done', key: 'hist.outDone' },
  { id: 'returned', key: 'hist.outReturned' },
  { id: 'cancelled', key: 'hist.outCancelled' },
] as const

const chip = (on: boolean) =>
  cn(
    'h-8 shrink-0 rounded-full border px-3 text-xs font-semibold transition',
    on ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-fg)]' : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg-muted)] hover:border-[var(--brand)] hover:text-[var(--fg)]'
  )

/** Day heading in the feed: Today / Yesterday / the date */
function dayKey(at: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca' }).format(new Date(at))
}

/**
 * Admin → Team history (owner only): everything the staff did, newest first, filtered by person,
 * type and period; and the orders each one worked on (added, moved, called about), with where
 * they are now. Data: GET /admin/team-history (services/staffActivity.service.ts teamHistory).
 */
export function TeamHistory() {
  const tr = useAdminT()
  const [tab, setTab] = useState<'activity' | 'orders'>('activity')
  const [days, setDays] = useState(7)
  const [staff, setStaff] = useState('')
  const [type, setType] = useState('all')
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number]['id']>('all')

  const q = useQuery({
    queryKey: ['team-history', days, staff],
    queryFn: async () => (await teamActivityApi.history(days, staff || undefined)).data.data,
    staleTime: 30_000,
  })
  const data = q.data

  const feed = useMemo(() => {
    const kinds = TYPES.find((t) => t.id === type)?.kinds
    return (data?.feed ?? []).filter((f) => !kinds || kinds.includes(f.kind))
  }, [data, type])
  const orders = useMemo(() => (data?.orders ?? []).filter((o) => outcome === 'all' || o.outcome === outcome), [data, outcome])

  const lineText = (f: TeamHistoryItem) => {
    if (f.kind === 'order-status' && f.orderNumber && f.status) return tr('hist.lineStatus', { number: f.orderNumber, status: orderStatusLabel(f.status) })
    if (f.kind === 'order-contact' && f.orderNumber && f.outcome) {
      const outcomeText = tr(`hist.out.${f.outcome}` as AdminKey)
      const key: AdminKey = f.channel === 'whatsapp' ? 'hist.lineWhatsapp' : f.channel === 'sms' ? 'hist.lineSms' : f.channel === 'email' ? 'hist.lineEmail' : 'hist.lineCall'
      return tr(key, { number: f.orderNumber, outcome: outcomeText })
    }
    return f.action
  }
  const today = dayKey(new Date().toISOString())
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString())
  const dayTitle = (k: string, at: string) =>
    k === today ? tr('hist.today') : k === yesterday ? tr('hist.yesterday') : new Date(at).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
  const roleName = (role: string) => (role === 'admin' ? tr('hist.owner') : tr(`role.${role}` as AdminKey))

  return (
    <div className="min-w-0 space-y-4">
      <AdminHeader title={tr('hist.title')} description={tr('hist.desc')} />

      {/* Filters: person, period, then the tabs */}
      <div className="flex min-w-0 flex-wrap items-end gap-3">
        <label className="flex min-w-[12rem] flex-col gap-1 text-xs font-medium text-[var(--fg-muted)]">
          {tr('hist.person')}
          <select
            value={staff}
            onChange={(e) => setStaff(e.target.value)}
            className="h-10 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3 text-sm text-[var(--fg)] outline-none focus:border-[var(--brand)]"
          >
            <option value="">{tr('hist.everyone')}</option>
            {(data?.staff ?? []).map((s) => (
              <option key={s._id} value={s._id}>
                {s.name} · {roleName(s.role)}
                {!s.isActive ? ` (${tr('hist.disabled')})` : ''}
              </option>
            ))}
          </select>
        </label>
        <div role="radiogroup" aria-label={tr('hist.period')} className="inline-flex rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] p-0.5 text-xs">
          {ACTIVITY_PERIODS.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={days === d}
              onClick={() => setDays(d)}
              className={cn('h-8 rounded-full px-3 font-medium transition', days === d ? 'bg-[var(--brand)] text-[var(--brand-fg)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]')}
            >
              {d === 365 ? tr('hist.year') : tr('hist.days', { days: d })}
            </button>
          ))}
        </div>
        {staff ? (
          <Link to={`/admin/roles/${staff}`} className="inline-flex h-10 items-center gap-1 text-sm font-medium text-[var(--brand-text)] hover:underline">
            {tr('hist.openProfile')}
            <SiteIcon name="chevron-right" size={14} className="rtl:rotate-180" />
          </Link>
        ) : null}
      </div>

      <div role="tablist" className="flex gap-1 border-b border-[var(--border)]">
        {(['activity', 'orders'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition',
              tab === id ? 'border-[var(--brand)] text-[var(--fg)]' : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]'
            )}
          >
            {id === 'activity' ? tr('hist.tabActivity') : tr('hist.tabOrders')}
            {id === 'orders' && data ? <span className="ms-1.5 text-xs font-normal text-[var(--fg-muted)]">{data.orders.length}</span> : null}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : q.isError || !data ? (
        <QueryErrorState onRetry={() => q.refetch()} />
      ) : tab === 'activity' ? (
        <section className="space-y-3">
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {TYPES.map((t) => (
              <button key={t.id} type="button" aria-pressed={type === t.id} onClick={() => setType(t.id)} className={chip(type === t.id)}>
                {tr(t.key)}
              </button>
            ))}
          </div>
          {feed.length ? (
            <ol className="space-y-4">
              {feed.map((f, i) => {
                const k = dayKey(f.at)
                const newDay = i === 0 || dayKey(feed[i - 1].at) !== k
                const row = (
                  <div className="flex min-w-0 items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 transition hover:border-[var(--brand)]">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--bg-muted)] text-[var(--brand-text)]">
                      <SiteIcon name={KIND_ICON[f.kind] ?? 'pencil'} size={15} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium">
                        <bdi>{lineText(f)}</bdi>
                      </p>
                      {f.detail ? <p className="mt-0.5 break-words text-xs text-[var(--fg-muted)]">{f.detail}</p> : null}
                      <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                        <span className="font-semibold text-[var(--fg)]">{f.byName}</span>
                        {f.role ? ` · ${roleName(f.role)}` : ''} · {formatDateTime(f.at)}
                      </p>
                    </div>
                    {f.link ? <SiteIcon name="chevron-right" size={15} className="mt-2 shrink-0 text-[var(--fg-muted)] rtl:rotate-180" /> : null}
                  </div>
                )
                return (
                  <li key={`${f.at}-${i}`} className="space-y-2">
                    {newDay ? <h2 className="pt-1 text-xs font-bold uppercase tracking-wide text-[var(--fg-muted)]">{dayTitle(k, f.at)}</h2> : null}
                    {f.link ? <Link to={f.link} className="block">{row}</Link> : row}
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--fg-muted)]">{tr('hist.empty')}</p>
          )}
          {data.feed.length >= 500 ? <p className="text-xs text-[var(--fg-muted)]">{tr('hist.shown', { count: data.feed.length })}</p> : null}
          <p className="text-[11px] text-[var(--fg-muted)]">{tr('hist.note')}</p>
        </section>
      ) : (
        <section className="space-y-3">
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {OUTCOMES.map((o) => {
              const n = o.id === 'all' ? data.orders.length : data.orders.filter((x) => x.outcome === o.id).length
              return (
                <button key={o.id} type="button" aria-pressed={outcome === o.id} onClick={() => setOutcome(o.id)} className={chip(outcome === o.id)}>
                  {tr(o.key)} <span className="tabular-nums opacity-75">{n}</span>
                </button>
              )
            })}
          </div>
          {orders.length ? (
            <ul className="space-y-2">
              {orders.map((o) => (
                <OrderRow key={o._id} o={o} />
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--fg-muted)]">{tr('hist.noOrders')}</p>
          )}
        </section>
      )}
    </div>
  )
}

/** One order a staff member worked on: where it is now, who added / moved it, the last step */
function OrderRow({ o }: { o: TeamHistoryOrder }) {
  const tr = useAdminT()
  return (
    <li>
      <Link
        to={`/admin/orders/${o._id}`}
        className="flex min-w-0 flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 transition hover:border-[var(--brand)] sm:flex-row sm:items-center sm:gap-4"
      >
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 flex-wrap items-center gap-2">
            <bdi dir="ltr" className="text-sm font-bold">
              #{o.orderNumber}
            </bdi>
            <Badge variant={orderStatusVariant(o.status)}>{orderStatusLabel(o.status)}</Badge>
            <span className="truncate text-xs text-[var(--fg-muted)]">{o.customer}</span>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--fg-muted)]">
            {o.addedBy ? <span className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 font-medium text-[var(--fg)]">{tr('hist.addedBy', { name: o.addedBy.name })}</span> : null}
            {o.staff.length ? <span>{tr('hist.workedBy')}:</span> : null}
            {o.staff.map((s) => (
              <span key={s._id} className="rounded-full border border-[var(--border)] px-2 py-0.5">
                {s.name}
                {s.steps ? ` · ${s.steps === 1 ? tr('hist.stepOne') : tr('hist.steps', { count: s.steps })}` : ''}
              </span>
            ))}
          </p>
          {o.last ? (
            <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
              {tr('hist.lastStep', { status: orderStatusLabel(o.last.status), name: o.last.byName, when: formatDateTime(o.last.at) })}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(o.total)}</span>
      </Link>
    </li>
  )
}
