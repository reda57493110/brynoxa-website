import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi, type StorageReport } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { toast } from '@/store/toastStore'
import { SettingsCard } from './SettingsUi'
import { cn } from '@/lib/cn'

type Level = StorageReport['level']

const LEVEL: Record<Level, { bar: string; text: string }> = {
  ok: { bar: 'bg-[var(--success)]', text: 'Plenty of room.' },
  watch: { bar: 'bg-[var(--warning)]', text: 'Getting fuller — keep an eye on it.' },
  high: { bar: 'bg-[var(--danger)]', text: 'Almost full — free some space soon.' },
}

/** MongoDB Atlas plans and their database size (Atlas → your cluster shows which one you have). */
const PLANS: { mb: number; label: string }[] = [
  { mb: 512, label: 'Free (M0) — 512 MB' },
  { mb: 5 * 1024, label: 'Flex — 5 GB' },
  { mb: 10 * 1024, label: 'M10 — 10 GB' },
  { mb: 20 * 1024, label: 'M20 — 20 GB' },
  { mb: 40 * 1024, label: 'M30 — 40 GB' },
]

/** "5.2 MB", "512 MB", "820 KB", "1.1 GB" */
export function sizeLabel(bytes: number) {
  const one = (n: number) => n.toFixed(1).replace(/\.0$/, '')
  if (bytes >= 1024 ** 3) return `${one(bytes / 1024 ** 3)} GB`
  if (bytes >= 1024 ** 2) return `${one(bytes / 1024 ** 2)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

function Bar({ percent, level, label }: { percent: number; level: Level; label: string }) {
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-[var(--bg-muted)]"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.min(100, Math.round(percent))}
    >
      <div className={cn('h-full rounded-full', LEVEL[level].bar)} style={{ width: `${Math.min(100, Math.max(1, percent))}%` }} />
    </div>
  )
}

/** Choose the MongoDB plan you pay for, so the bar measures against the right size. */
function PlanPicker({ s }: { s: StorageReport }) {
  const qc = useQueryClient()
  const preset = PLANS.some((p) => p.mb === s.limitMb) ? String(s.limitMb) : 'custom'
  const [choice, setChoice] = useState(preset)
  const [customGb, setCustomGb] = useState(preset === 'custom' ? String(Math.round((s.limitMb / 1024) * 10) / 10) : '')
  const save = useMutation({
    mutationFn: async (limitMb: number) => (await adminApi.settings.setStorageLimit(limitMb)).data.data,
    onSuccess: (data) => {
      qc.setQueryData(['admin-storage'], data)
      toast.success('Plan size saved')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const customMb = Math.round(Number(customGb.replace(',', '.')) * 1024)
  const target = choice === 'custom' ? customMb : Number(choice)
  const valid = Number.isFinite(target) && target >= 100
  const changed = valid && target !== s.limitMb

  return (
    <div className="flex flex-wrap items-end gap-2 border-t border-[var(--border)] pt-3">
      <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-[var(--fg-muted)]">Your MongoDB plan</span>
        <select
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className="h-10 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3 text-sm text-[var(--fg)] outline-none focus:border-[var(--brand)]"
        >
          {PLANS.map((p) => (
            <option key={p.mb} value={String(p.mb)}>
              {p.label}
            </option>
          ))}
          <option value="custom">Other size…</option>
        </select>
      </label>
      {choice === 'custom' ? (
        <label className="flex w-28 flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-[var(--fg-muted)]">Size (GB)</span>
          <input
            inputMode="decimal"
            value={customGb}
            onChange={(e) => setCustomGb(e.target.value)}
            placeholder="e.g. 2"
            className="h-10 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3 text-sm tabular-nums text-[var(--fg)] outline-none focus:border-[var(--brand)]"
          />
        </label>
      ) : null}
      <Button size="sm" className="h-10" disabled={!changed} loading={save.isPending} onClick={() => save.mutate(target)}>
        Save
      </Button>
      <p className="w-full text-xs text-[var(--fg-muted)]">
        {s.limitSource === 'set'
          ? 'Changed plan in MongoDB Atlas? Pick the new one here.'
          : 'Not sure? MongoDB Atlas → your cluster shows the plan (Free / M0 if you never paid).'}
      </p>
    </div>
  )
}

/** Cloudinary's own plan and usage, read from Cloudinary (shown once it is connected). */
function CloudinaryUsage({ s }: { s: StorageReport }) {
  if (!s.cloudinary) {
    return (
      <p className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
        <SiteIcon name="monitor" size={14} />
        Cloudinary: not connected. Its plan and usage will show here once its keys are added in Vercel.
      </p>
    )
  }
  const c = s.cloudinaryUsage
  if (!c) {
    return <p className="text-xs text-[var(--fg-muted)]">Cloudinary is connected; its usage couldn’t be read right now.</p>
  }
  return (
    <div className="space-y-2 rounded-xl border border-[var(--border)] p-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">
          Cloudinary <span className="font-normal text-[var(--fg-muted)]">· {c.plan ? `${c.plan} plan` : 'connected'}</span>
        </p>
        {c.creditsPercent !== null ? <p className="text-sm tabular-nums text-[var(--fg-muted)]">{c.creditsPercent}%</p> : null}
      </div>
      {c.creditsPercent !== null ? <Bar percent={c.creditsPercent} level={c.level} label="Cloudinary credits used" /> : null}
      <p className="text-xs text-[var(--fg-muted)]">
        {[
          c.storageBytes !== null ? `${sizeLabel(c.storageBytes)} of photos stored` : null,
          c.creditsUsed !== null && c.creditsLimit ? `${c.creditsUsed} of ${c.creditsLimit} monthly credits used` : null,
          c.bandwidthBytes !== null ? `${sizeLabel(c.bandwidthBytes)} sent to visitors` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </div>
  )
}

/** Admin → Settings → General: how full the database is, what takes the room, and Cloudinary's usage. */
export function StorageCard() {
  const storage = useQuery({
    queryKey: ['admin-storage'],
    queryFn: async () => (await adminApi.settings.storage()).data.data,
    staleTime: 60_000,
  })
  const s = storage.data

  return (
    <SettingsCard title="Storage" description="How full your database is (MongoDB), against your plan’s size. Updated each time you open it.">
      {storage.isPending ? (
        <Skeleton className="h-16 rounded-xl" />
      ) : storage.isError || !s ? (
        <p className="text-sm text-[var(--fg-muted)]">
          Couldn’t read the database size.{' '}
          <button type="button" onClick={() => storage.refetch()} className="font-medium text-[var(--brand-text)] hover:underline">
            Try again
          </button>
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-display text-lg font-semibold tabular-nums">
              {sizeLabel(s.usedBytes)} <span className="text-sm font-normal text-[var(--fg-muted)]">of {sizeLabel(s.limitBytes)}</span>
            </p>
            <p className="text-sm font-medium tabular-nums text-[var(--fg-muted)]">{s.percent}%</p>
          </div>
          <Bar percent={s.percent} level={s.level} label="Database used" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">{LEVEL[s.level].text}</p>
            <button
              type="button"
              onClick={() => storage.refetch()}
              disabled={storage.isFetching}
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-text)] hover:underline disabled:opacity-60"
            >
              <SiteIcon name="refresh" size={13} className={storage.isFetching ? 'animate-spin' : undefined} />
              {storage.isFetching ? 'Checking…' : 'Refresh'}
            </button>
          </div>

          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {[
              ['Photos in the database', s.photos.count ? `${s.photos.count} · ${sizeLabel(s.photos.bytes)}` : 'None'],
              ['Products', String(s.counts.products)],
              ['Orders', String(s.counts.orders)],
              ['Customers', String(s.counts.customers)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-[var(--bg-muted)] px-3 py-2">
                <dt className="text-xs text-[var(--fg-muted)]">{label}</dt>
                <dd className="font-medium tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          <p className="text-xs text-[var(--fg-muted)]">
            {s.cloudinary
              ? s.photos.count
                ? 'New photos go to Cloudinary. Move the older ones from Products to free this space.'
                : 'Your photos are on Cloudinary, so they take no room here.'
              : s.suggestCloudinary
                ? 'Photos take a large part of this space. Setting up Cloudinary and moving them frees it.'
                : 'Photos you upload are stored here. When you have many products with your own photos, Cloudinary keeps them out of the database.'}
            {s.photos.count && (s.cloudinary || s.suggestCloudinary) ? (
              <>
                {' '}
                <Link to="/admin/products" className="font-medium text-[var(--brand-text)] hover:underline">
                  Products
                </Link>
              </>
            ) : null}
          </p>

          <CloudinaryUsage s={s} />
          <PlanPicker key={s.limitMb} s={s} />
        </div>
      )}
    </SettingsCard>
  )
}
