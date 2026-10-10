import { useRef, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { CalculationNote, PeriodFilter, StatusBadge, TypeBadge } from '@/components/admin/customers/shared'
import { SEGMENT_LABELS, type Period } from '@/components/admin/customers/utils'
import { ProfileOverview } from '@/components/admin/customers/ProfileOverview'
import { ProfileOrders } from '@/components/admin/customers/ProfileOrders'
import { ProfileProfitability } from '@/components/admin/customers/ProfileProfitability'
import { ProfilePayments } from '@/components/admin/customers/ProfilePayments'
import { ProfileActivity } from '@/components/admin/customers/ProfileActivity'
import { toast } from '@/store/toastStore'
import { cn } from '@/lib/cn'
import type { CustomerProfile as Profile, CustomerUpdatePayload, WholesaleReviewPayload } from '@/types'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'orders', label: 'Orders & sales' },
  { id: 'profit', label: 'Profitability' },
  { id: 'payments', label: 'Payments' },
  { id: 'activity', label: 'Activity' },
] as const
type TabId = (typeof TABS)[number]['id']

export function CustomerProfile() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const period: Period = { from: params.get('from') || '', to: params.get('to') || '' }
  const tabParam = params.get('tab') as TabId | null
  const tab: TabId = TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : 'overview'
  const [confirm, setConfirm] = useState<null | 'toggle' | 'delete'>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const setParam = (patch: Record<string, string | undefined>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
        return next
      },
      { replace: true }
    )

  const queryKey = ['admin-customer', id, { from: period.from, to: period.to }]
  const profile = useQuery({
    queryKey,
    queryFn: async () =>
      (
        await adminApi.customers.profile(id, {
          from: period.from || undefined,
          to: period.to || undefined,
        })
      ).data.data,
    enabled: Boolean(id),
    placeholderData: keepPreviousData,
  })

  const afterChange = (data?: Profile) => {
    if (data) qc.setQueryData(queryKey, data)
    qc.invalidateQueries({ queryKey: ['admin-customer', id] })
    qc.invalidateQueries({ queryKey: ['admin-customers'] })
    qc.invalidateQueries({ queryKey: ['admin-customer-summary'] })
  }

  const updateMut = useMutation({
    mutationFn: async (payload: CustomerUpdatePayload) => (await adminApi.customers.update(id, payload)).data.data,
    onSuccess: (data) => afterChange(data),
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const reviewMut = useMutation({
    mutationFn: async (payload: WholesaleReviewPayload) =>
      (await adminApi.customers.reviewWholesale(id, payload)).data.data,
    onSuccess: (data) => afterChange(data),
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const toggleMut = useMutation({
    mutationFn: async (isActive: boolean) => (await adminApi.customers.setActive(id, isActive)).data.data,
    onSuccess: (data, isActive) => {
      afterChange(data)
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
      toast.success(isActive ? 'Customer enabled' : 'Customer disabled')
      setConfirm(null)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const removeMut = useMutation({
    mutationFn: () => adminApi.customers.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-customers'] })
      qc.invalidateQueries({ queryKey: ['admin-customer-summary'] })
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
      qc.removeQueries({ queryKey: ['admin-customer', id] })
      toast.success('Customer deleted')
      navigate('/admin/customers')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const save = async (payload: CustomerUpdatePayload, msg: string) => {
    try {
      await updateMut.mutateAsync(payload)
      toast.success(msg)
      return true
    } catch {
      return false
    }
  }

  const review = async (payload: WholesaleReviewPayload, msg: string) => {
    try {
      await reviewMut.mutateAsync(payload)
      toast.success(msg)
      return true
    } catch {
      return false
    }
  }

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = -1
    if (e.key === 'ArrowRight') next = (index + 1) % TABS.length
    else if (e.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = TABS.length - 1
    if (next < 0) return
    e.preventDefault()
    setParam({ tab: TABS[next].id === 'overview' ? undefined : TABS[next].id })
    tabRefs.current[next]?.focus()
  }

  const backLink = (
    <Link to="/admin/customers" className="inline-flex items-center gap-1 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
      <SiteIcon name="arrow-left" size={14} /> Customers
    </Link>
  )

  if (profile.isPending && !profile.data) {
    return (
      <div className="space-y-4">
        {backLink}
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      </div>
    )
  }
  if (profile.isError || !profile.data) {
    return (
      <div className="space-y-4">
        {backLink}
        <QueryErrorState title="Could not load this customer" onRetry={() => profile.refetch()} />
      </div>
    )
  }

  const data = profile.data
  const c = data.customer
  const hasPeriod = Boolean(period.from || period.to) && Boolean(data.period)
  const metrics = hasPeriod && data.period ? data.period : data.lifetime
  const scope = hasPeriod ? 'Selected period' : 'Lifetime'
  const lifetimeForHints = hasPeriod ? data.lifetime : null
  const busy = updateMut.isPending || reviewMut.isPending

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      {backLink}

      {/* Header */}
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-lg font-semibold tracking-tight break-words sm:text-2xl">{c.name}</h1>
          <p className="mt-0.5 text-sm break-all text-[var(--fg-muted)]">
            {c.customerId} · {c.email}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <TypeBadge type={c.customerType} tierName={c.tier?.name} />
            <StatusBadge status={c.status} />
            {c.isGuest ? <Badge variant="muted">Guest</Badge> : null}
            {c.segments.map((s) => (
              <Badge key={s} variant="default">
                {SEGMENT_LABELS[s] ?? s}
              </Badge>
            ))}
          </div>
          {c.inactive ? (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] px-3 py-1.5 text-xs text-[var(--warning)]">
              <SiteIcon name="alert" size={14} /> Inactive for {c.daysInactive} days (threshold {c.inactiveDays} days)
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/admin/emails?to=${encodeURIComponent(c.email)}`}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--border)] px-3 text-sm hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
          >
            <SiteIcon name="mail" size={14} /> Email customer
          </Link>
          <Button size="sm" variant="outline" onClick={() => setConfirm('toggle')}>
            {c.isActive ? 'Disable' : 'Enable'}
          </Button>
          <Button size="sm" variant="outline" className="text-[var(--danger)]" onClick={() => setConfirm('delete')}>
            <SiteIcon name="trash" size={14} /> Delete
          </Button>
        </div>
      </div>

      <PeriodFilter value={period} onChange={(p) => setParam({ from: p.from || undefined, to: p.to || undefined })} />

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Customer sections"
        className="-mx-3 flex gap-1 overflow-x-auto border-b border-[var(--border)] px-3 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              tabRefs.current[i] = el
            }}
            type="button"
            role="tab"
            id={`customer-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`customer-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onKeyDown={(e) => onTabKey(e, i)}
            onClick={() => setParam({ tab: t.id === 'overview' ? undefined : t.id })}
            className={cn(
              '-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition ring-brand',
              tab === t.id
                ? 'border-[var(--brand)] font-medium text-[var(--brand-text)]'
                : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`customer-panel-${tab}`}
        aria-labelledby={`customer-tab-${tab}`}
        tabIndex={0}
        className="min-w-0 outline-none"
      >
        {tab === 'overview' ? <ProfileOverview profile={data} save={save} review={review} busy={busy} /> : null}
        {tab === 'orders' ? (
          <ProfileOrders profile={data} metrics={metrics} scope={scope} lifetime={lifetimeForHints} />
        ) : null}
        {tab === 'profit' ? (
          <ProfileProfitability metrics={metrics} lifetime={data.lifetime} scope={scope} />
        ) : null}
        {tab === 'payments' ? (
          <ProfilePayments profile={data} metrics={metrics} lifetime={lifetimeForHints} scope={scope} />
        ) : null}
        {tab === 'activity' ? <ProfileActivity timeline={data.timeline} /> : null}
      </div>

      {tab !== 'overview' && tab !== 'activity' ? <CalculationNote /> : null}

      <ConfirmDialog
        open={confirm === 'toggle'}
        title={c.isActive ? 'Disable this customer?' : 'Enable this customer?'}
        description={
          c.isActive
            ? `${c.name} will be signed out and unable to sign in. Orders are not affected.`
            : `${c.name} will be able to sign in and order again.`
        }
        confirmLabel={c.isActive ? 'Disable' : 'Enable'}
        loading={toggleMut.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => toggleMut.mutate(!c.isActive)}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title="Delete this customer account?"
        description={`This permanently deletes ${c.name}'s account, wishlist and reviews. Orders and financial records are kept.`}
        confirmLabel="Delete account"
        loading={removeMut.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => removeMut.mutate()}
      />
    </div>
  )
}
