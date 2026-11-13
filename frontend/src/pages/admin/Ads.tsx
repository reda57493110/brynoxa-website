import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Spinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Badge } from '@/components/ui/Badge'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { Panel } from '@/components/admin/Panel'
import { toast } from '@/store/toastStore'
import { formatCurrency, formatDate } from '@/lib/format'
import { absolute } from '@/lib/structuredData'
import { cn } from '@/lib/cn'
import { hasPermission } from '@/lib/permissions'
import { useAuthStore } from '@/store/authStore'
import {
  AD_KINDS,
  AD_KIND_LABEL,
  AD_PLATFORMS,
  AD_PLATFORM_LABEL,
  roasLabel,
  trackingLink,
  type AdKind,
  type AdPlatform,
} from '@/lib/adTracking'
import type { AdCampaign, AdCampaignPayload, AdCampaignRow, AdRange, AdResults } from '@/types/ads'

const RANGES: { value: AdRange; label: string }[] = [
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
  { value: 365, label: 'Last 12 months' },
  { value: 0, label: 'Since the start' },
]

const today = () => new Date().toISOString().slice(0, 10)
const shopOrigin = () => absolute('/').replace(/\/$/, '')
const linkOf = (c: AdCampaign) => trackingLink(shopOrigin(), c.landingPath, c.trackingQuery)

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Link copied — paste it in your ad or post')
  } catch {
    toast.error('Could not copy. Select the link and copy it.')
  }
}

/** One figure of the results row */
function Figure({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 sm:p-4">
      <p className="truncate text-[11px] font-medium uppercase tracking-wide text-[var(--fg-muted)]">{label}</p>
      <p
        className={cn(
          'mt-1 truncate font-display text-lg font-semibold tabular-nums sm:text-2xl',
          tone === 'good' && 'text-[var(--success)]',
          tone === 'bad' && 'text-[var(--danger)]'
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] leading-snug text-[var(--fg-muted)]">{hint}</p> : null}
    </div>
  )
}

/** Return for 1 DH spent: green when the ad brings more than it costs, red when less */
const roasTone = (r: AdResults) => (r.roas === null ? undefined : r.roas >= 1 ? 'good' : 'bad')

/** Spent · orders · revenue · cost per order · return, small (a campaign card, a platform row) */
function MiniResults({ r }: { r: AdResults }) {
  const cells: [string, string, string?][] = [
    ['Spent', formatCurrency(r.spent)],
    ['Orders', String(r.orders)],
    ['Revenue', formatCurrency(r.revenue)],
    ['Per order', r.costPerOrder === null ? '—' : formatCurrency(r.costPerOrder)],
    ['For 1 DH', roasLabel(r.roas), roasTone(r)],
  ]
  return (
    <dl className="grid grid-cols-3 gap-x-3 gap-y-2 sm:grid-cols-5">
      {cells.map(([label, value, tone]) => (
        <div key={label} className="min-w-0">
          <dt className="truncate text-[10px] font-medium uppercase tracking-wide text-[var(--fg-muted)]">{label}</dt>
          <dd
            className={cn(
              'truncate text-sm font-semibold tabular-nums',
              tone === 'good' && 'text-[var(--success)]',
              tone === 'bad' && 'text-[var(--danger)]'
            )}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

type FormState = {
  name: string
  platform: AdPlatform
  kind: AdKind
  landingPath: string
  startDate: string
  endDate: string
  budget: string
  notes: string
}

const EMPTY: FormState = { name: '', platform: 'facebook', kind: 'paid', landingPath: '/', startDate: today(), endDate: '', budget: '', notes: '' }

const formOf = (c: AdCampaign): FormState => ({
  name: c.name,
  platform: c.platform,
  kind: c.kind,
  landingPath: c.landingPath || '/',
  startDate: c.startDate,
  endDate: c.endDate,
  budget: c.budget === null ? '' : String(c.budget),
  notes: c.notes,
})

/** Add / edit a campaign */
function CampaignForm({ editing, onClose }: { editing: AdCampaign | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<FormState>(editing ? formOf(editing) : EMPTY)
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const budget = form.budget.trim() === '' ? undefined : Number(form.budget)
  const errors = {
    name: form.name.trim().length > 0 && form.name.trim().length < 2 ? '2 characters or more' : undefined,
    landingPath: form.landingPath && !/^\/(?!\/)\S*$/.test(form.landingPath.trim()) ? 'Start with / — e.g. /shop or /products/…' : undefined,
    budget: budget !== undefined && (!Number.isFinite(budget) || budget < 0) ? '0 or more' : undefined,
    endDate: form.startDate && form.endDate && form.endDate < form.startDate ? 'Before the start date' : undefined,
  }
  const valid = form.name.trim().length >= 2 && !Object.values(errors).some(Boolean)

  const save = useMutation({
    mutationFn: () => {
      const payload: AdCampaignPayload = {
        name: form.name.trim(),
        platform: form.platform,
        kind: form.kind,
        landingPath: form.landingPath.trim() || '/',
        startDate: form.startDate,
        endDate: form.endDate,
        notes: form.notes.trim(),
        ...(budget !== undefined ? { budget } : {}),
      }
      return editing ? adminApi.ads.update(editing._id, payload) : adminApi.ads.create(payload)
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['admin-ads'] })
      toast.success(editing ? 'Campaign saved' : 'Campaign added — copy its link into your ad')
      if (!editing) void copy(linkOf(res.data.data))
      onClose()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <form
      className="grid grid-cols-2 gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) save.mutate()
      }}
    >
      <div className="col-span-2">
        <Input label="Name" value={form.name} maxLength={120} placeholder="e.g. Gaming PCs — November" onChange={(e) => set('name', e.target.value)} error={errors.name} required />
      </div>
      <Select
        label="Platform"
        value={form.platform}
        onChange={(e) => set('platform', e.target.value as AdPlatform)}
        options={AD_PLATFORMS.map((p) => ({ value: p, label: AD_PLATFORM_LABEL[p] }))}
      />
      <Select
        label="Type"
        value={form.kind}
        onChange={(e) => set('kind', e.target.value as AdKind)}
        options={AD_KINDS.map((k) => ({ value: k, label: AD_KIND_LABEL[k] }))}
      />
      <Input label="Starts" type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
      <Input label="Ends (optional)" type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} error={errors.endDate} />
      {form.kind === 'paid' ? (
        <Input
          label="Planned budget (DH, optional)"
          type="number"
          min={0}
          step="any"
          value={form.budget}
          onChange={(e) => set('budget', e.target.value)}
          error={errors.budget}
        />
      ) : null}
      <div className={form.kind === 'paid' ? '' : 'col-span-2'}>
        <Input
          label="Page the link opens"
          value={form.landingPath}
          maxLength={300}
          placeholder="/"
          onChange={(e) => set('landingPath', e.target.value)}
          error={errors.landingPath}
        />
      </div>
      <div className="col-span-2">
        <Textarea label="Notes (optional)" rows={2} maxLength={1000} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Audience, product shown, what you are testing…" />
      </div>
      {editing ? (
        <p className="col-span-2 text-[11px] text-[var(--fg-muted)]">The tracking link does not change, so ads already running keep counting.</p>
      ) : (
        <p className="col-span-2 text-[11px] text-[var(--fg-muted)]">After saving, the campaign&apos;s link is copied: put it in the ad or the post.</p>
      )}
      <div className="col-span-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending} disabled={!valid}>
          {editing ? 'Save' : 'Add campaign'}
        </Button>
      </div>
    </form>
  )
}

/** Record money paid to the platform (counts in Profit too) */
function SpendForm({ campaign, onClose }: { campaign: AdCampaign; onClose: () => void }) {
  const qc = useQueryClient()
  const [amount, setAmount] = useState('')
  const [day, setDay] = useState(today())
  const [note, setNote] = useState('')
  const n = Number(amount)
  const valid = amount !== '' && Number.isFinite(n) && n > 0 && /^\d{4}-\d{2}-\d{2}$/.test(day)
  const add = useMutation({
    mutationFn: () => adminApi.ads.addSpend(campaign._id, { amount: n, day, note: note.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ads'] })
      qc.invalidateQueries({ queryKey: ['admin-profit'] })
      toast.success(`${formatCurrency(n)} added to ${campaign.name}`)
      onClose()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  return (
    <form
      className="grid grid-cols-2 gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) add.mutate()
      }}
    >
      <Input label="Amount (DH)" type="number" min={0} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus required />
      <Input label="Day" type="date" value={day} max={today()} onChange={(e) => setDay(e.target.value)} required />
      <div className="col-span-2">
        <Input label="Note (optional)" value={note} maxLength={300} placeholder="e.g. Meta invoice, card top-up" onChange={(e) => setNote(e.target.value)} />
      </div>
      <p className="col-span-2 text-[11px] text-[var(--fg-muted)]">Also counted in Profit, as an &quot;Ads&quot; expense.</p>
      <div className="col-span-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={add.isPending} disabled={!valid}>
          Add spending
        </Button>
      </div>
    </form>
  )
}

/** A campaign: its link, everything spent and the orders it brought */
function CampaignDetail({ id }: { id: string }) {
  const qc = useQueryClient()
  const detail = useQuery({
    queryKey: ['admin-ads', 'detail', id],
    queryFn: async () => (await adminApi.ads.get(id)).data.data,
  })
  const removeSpend = useMutation({
    mutationFn: (spendId: string) => adminApi.ads.removeSpend(id, spendId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ads'] })
      qc.invalidateQueries({ queryKey: ['admin-profit'] })
      toast.success('Spending removed')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  if (detail.isLoading) return <div className="flex justify-center py-8"><Spinner /></div>
  if (detail.isError || !detail.data) return <QueryErrorState onRetry={() => detail.refetch()} />
  const { campaign, spends, orders } = detail.data
  const link = linkOf(campaign)
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-xs font-medium text-[var(--fg-muted)]">Tracking link</p>
        <div className="flex min-w-0 items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-[var(--bg-muted)] px-2.5 py-2 text-xs" title={link}>
            {link}
          </code>
          <Button size="sm" variant="outline" onClick={() => copy(link)}>
            Copy
          </Button>
        </div>
      </div>
      {campaign.notes ? <p className="whitespace-pre-line text-sm text-[var(--fg-muted)]">{campaign.notes}</p> : null}
      <div>
        <p className="mb-1.5 text-xs font-medium text-[var(--fg-muted)]">Spending ({spends.length})</p>
        {spends.length ? (
          <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
            {spends.map((s) => (
              <li key={s._id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-24 shrink-0 text-[var(--fg-muted)]">{formatDate(s.day)}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-[var(--fg-muted)]">{s.note}</span>
                <span className="font-semibold tabular-nums">{formatCurrency(s.amount)}</span>
                <button
                  type="button"
                  onClick={() => removeSpend.mutate(s._id)}
                  disabled={removeSpend.isPending}
                  aria-label={`Remove ${formatCurrency(s.amount)} of ${formatDate(s.day)}`}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:text-[var(--danger)]"
                >
                  <SiteIcon name="trash" size={13} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[var(--fg-muted)]">{campaign.kind === 'organic' ? 'Free post: nothing to pay.' : 'Nothing recorded yet.'}</p>
        )}
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-[var(--fg-muted)]">Latest orders through the link ({orders.length})</p>
        {orders.length ? (
          <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
            {orders.map((o) => (
              <li key={o._id}>
                <Link to={`/admin/orders/${o._id}`} className={cn('flex items-center gap-3 px-3 py-2 text-sm hover:bg-[var(--bg-muted)]', !o.counted && 'opacity-60')}>
                  <span className="min-w-0 flex-1 truncate font-medium">{o.orderNumber}</span>
                  <span className="hidden text-xs text-[var(--fg-muted)] sm:inline">{formatDate(o.createdAt)}</span>
                  <Badge variant={o.counted ? 'muted' : 'danger'}>{o.status.replace(/_/g, ' ')}</Badge>
                  <span className="font-semibold tabular-nums">{formatCurrency(o.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[var(--fg-muted)]">No order yet. Orders count when the customer came through the link (up to 30 days before ordering).</p>
        )}
      </div>
    </div>
  )
}

function CampaignCard({
  c,
  onSpend,
  onDetail,
  onEdit,
  onDelete,
}: {
  c: AdCampaignRow
  onSpend: () => void
  onDetail: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const qc = useQueryClient()
  const toggle = useMutation({
    mutationFn: () => adminApi.ads.update(c._id, { isActive: !c.isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ads'] })
      toast.success(c.isActive ? 'Campaign marked as ended' : 'Campaign running again')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const used = c.budget ? Math.min(100, (c.spent / c.budget) * 100) : 0
  return (
    <li className={cn('min-w-0 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 sm:p-4', !c.isActive && 'opacity-75')}>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <button type="button" onClick={onDetail} className="min-w-0 text-start">
          <p className="truncate font-semibold hover:text-[var(--brand-text)]">{c.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--fg-muted)]">
            <Badge variant="brand">{AD_PLATFORM_LABEL[c.platform]}</Badge>
            <Badge variant="muted">{AD_KIND_LABEL[c.kind]}</Badge>
            <span>
              {c.startDate ? formatDate(c.startDate) : '—'}
              {c.endDate ? ` → ${formatDate(c.endDate)}` : ''}
            </span>
          </p>
        </button>
        <Badge variant={c.isActive ? 'success' : 'muted'}>{c.isActive ? 'Running' : 'Ended'}</Badge>
      </div>

      <div className="mt-3">
        <MiniResults r={c} />
      </div>

      {c.budget ? (
        <div className="mt-2.5">
          <div className="flex justify-between text-[11px] text-[var(--fg-muted)]">
            <span>Budget {formatCurrency(c.budget)}</span>
            <span className={cn((c.budgetLeft ?? 0) < 0 && 'text-[var(--danger)]')}>
              {(c.budgetLeft ?? 0) < 0 ? `${formatCurrency(-(c.budgetLeft ?? 0))} over` : `${formatCurrency(c.budgetLeft ?? 0)} left`}
            </span>
          </div>
          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[var(--bg-muted)]">
            <span className={cn('block h-full', used >= 100 ? 'bg-[var(--danger)]' : 'bg-[var(--brand)]')} style={{ width: `${used}%` }} />
          </span>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button size="sm" variant="outline" onClick={() => copy(linkOf(c))}>
          <SiteIcon name="external" size={13} /> Copy link
        </Button>
        {c.kind === 'paid' ? (
          <Button size="sm" onClick={onSpend}>
            <SiteIcon name="plus" size={13} /> Add spending
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" onClick={onDetail}>
          Details
        </Button>
        <span className="ms-auto flex gap-1">
          <Button size="sm" variant="ghost" disabled={toggle.isPending} onClick={() => toggle.mutate()}>
            {c.isActive ? 'End' : 'Run again'}
          </Button>
          <button type="button" onClick={onEdit} aria-label={`Edit ${c.name}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:text-[var(--fg)]">
            <SiteIcon name="pencil" size={14} />
          </button>
          <button type="button" onClick={onDelete} aria-label={`Delete ${c.name}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:text-[var(--danger)]">
            <SiteIcon name="trash" size={14} />
          </button>
        </span>
      </div>
    </li>
  )
}

/** Admin → Ads & social media: campaigns, what they cost and the orders they bring */
export function Ads() {
  const qc = useQueryClient()
  const [days, setDays] = useState<AdRange>(30)
  const [platform, setPlatform] = useState<AdPlatform | 'all'>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AdCampaign | null>(null)
  const [spendFor, setSpendFor] = useState<AdCampaign | null>(null)
  const [detailOf, setDetailOf] = useState<AdCampaign | null>(null)
  const [deleting, setDeleting] = useState<AdCampaign | null>(null)

  const overview = useQuery({
    queryKey: ['admin-ads', days],
    queryFn: async () => (await adminApi.ads.overview(days)).data.data,
  })

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.ads.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-ads'] })
      setDeleting(null)
      toast.success('Campaign deleted')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const data = overview.data
  const role = useAuthStore((st) => st.user?.role)
  const canSettings = hasPermission(role, 'settings')
  const adminSettings = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => (await adminApi.settings.get()).data.data,
    enabled: canSettings,
  })
  const pixelsSet = Boolean(adminSettings.data?.tracking?.metaPixelId || adminSettings.data?.tracking?.tiktokPixelId) || !adminSettings.data
  const t = data?.totals
  const campaigns = (data?.campaigns ?? []).filter((c) => platform === 'all' || c.platform === platform)

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <AdminHeader
        title="Ads & social media"
        description="Your ads and posts, what they cost you and the orders they bring."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Period"
              value={String(days)}
              onChange={(e) => setDays(Number(e.target.value) as AdRange)}
              options={RANGES.map((r) => ({ value: String(r.value), label: r.label }))}
            />
            <Button
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              <SiteIcon name="plus" size={14} /> New campaign
            </Button>
          </div>
        }
      />

      {overview.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : overview.isError || !data || !t ? (
        <QueryErrorState onRetry={() => overview.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5">
            <Figure label="Spent on ads" value={formatCurrency(t.spent)} hint={data.otherSpent ? `incl. ${formatCurrency(data.otherSpent)} with no campaign` : `${t.active} running · ${t.campaigns} in all`} />
            <Figure label="Orders from ads" value={String(t.orders)} hint="Cancelled / returned not counted" />
            <Figure label="Revenue from ads" value={formatCurrency(t.revenue)} />
            <Figure label="Cost per order" value={t.costPerOrder === null ? '—' : formatCurrency(t.costPerOrder)} hint="Spent ÷ orders" />
            <div className="col-span-2 lg:col-span-1">
              <Figure label="For 1 DH spent" value={roasLabel(t.roas)} hint="of sales come back" tone={roasTone(t)} />
            </div>
          </div>

          {canSettings && !pixelsSet ? (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-dashed border-[var(--border)] px-3 py-2.5 text-xs text-[var(--fg-muted)]">
              <SiteIcon name="alert" size={14} className="text-[var(--warning)]" />
              Facebook, Instagram and TikTok do not see your orders yet, so they cannot aim your ads at buyers.
              <Link to="/admin/settings?tab=tracking" className="font-semibold text-[var(--brand-text)] hover:underline">
                Add your pixels →
              </Link>
            </p>
          ) : null}

          {data.platforms.length ? (
            <Panel title="By platform" description="Where your money and your orders come from." compact>
              <ul className="divide-y divide-[var(--border)]">
                {data.platforms.map((p) => (
                  <li key={p.platform} className="flex flex-col gap-2 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4">
                    <button
                      type="button"
                      onClick={() => setPlatform(platform === p.platform ? 'all' : p.platform)}
                      className={cn('flex w-40 shrink-0 items-center gap-2 text-start text-sm font-semibold', platform === p.platform && 'text-[var(--brand-text)]')}
                    >
                      {AD_PLATFORM_LABEL[p.platform]}
                      <span className="text-[11px] font-normal text-[var(--fg-muted)]">
                        {p.campaigns} campaign{p.campaigns === 1 ? '' : 's'}
                      </span>
                    </button>
                    <div className="min-w-0 flex-1">
                      <MiniResults r={p} />
                    </div>
                  </li>
                ))}
              </ul>
              {data.otherLinks.orders ? (
                <p className="mt-3 text-[11px] text-[var(--fg-muted)]">
                  {data.otherLinks.orders} order{data.otherLinks.orders === 1 ? '' : 's'} ({formatCurrency(data.otherLinks.revenue)}) came through links of a deleted or unknown campaign — counted in the platform totals.
                </p>
              ) : null}
            </Panel>
          ) : null}

          <section className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">
                Campaigns {platform === 'all' ? '' : `· ${AD_PLATFORM_LABEL[platform]}`}
              </h2>
              {platform !== 'all' ? (
                <button type="button" onClick={() => setPlatform('all')} className="text-xs font-semibold text-[var(--brand-text)] hover:underline">
                  Show all platforms
                </button>
              ) : null}
            </div>
            {campaigns.length ? (
              <ul className="grid gap-2.5 xl:grid-cols-2">
                {campaigns.map((c) => (
                  <CampaignCard
                    key={c._id}
                    c={c}
                    onSpend={() => setSpendFor(c)}
                    onDetail={() => setDetailOf(c)}
                    onEdit={() => {
                      setEditing(c)
                      setFormOpen(true)
                    }}
                    onDelete={() => setDeleting(c)}
                  />
                ))}
              </ul>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-8 text-sm">
                <p className="text-center font-semibold">How it works</p>
                <ol className="mx-auto mt-3 max-w-md list-decimal space-y-1.5 ps-5 text-[var(--fg-muted)]">
                  <li>Add a campaign: the platform, paid ad or free post, the dates and a budget.</li>
                  <li>Copy its link and put it in your ad, post, story or bio.</li>
                  <li>Each time you pay the platform, add the amount (it counts in Profit too).</li>
                  <li>Orders made through the link are counted here: cost per order and what 1 DH brings back.</li>
                </ol>
                <div className="mt-4 flex justify-center">
                  <Button
                    onClick={() => {
                      setEditing(null)
                      setFormOpen(true)
                    }}
                  >
                    <SiteIcon name="plus" size={14} /> Add your first campaign
                  </Button>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? `Edit ${editing.name}` : 'New campaign'}>
        {formOpen ? <CampaignForm key={editing?._id ?? 'new'} editing={editing} onClose={() => setFormOpen(false)} /> : null}
      </Modal>
      <Modal open={Boolean(spendFor)} onClose={() => setSpendFor(null)} title={spendFor ? `Spending · ${spendFor.name}` : ''} size="sm">
        {spendFor ? <SpendForm campaign={spendFor} onClose={() => setSpendFor(null)} /> : null}
      </Modal>
      <Modal open={Boolean(detailOf)} onClose={() => setDetailOf(null)} title={detailOf?.name ?? ''} size="lg">
        {detailOf ? <CampaignDetail id={detailOf._id} /> : null}
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this campaign?"
        description="Its link stops being counted here. The money already spent stays in Profit as ads expenses."
        confirmLabel="Delete"
        loading={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting._id)}
      />
    </div>
  )
}
