import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { Skeleton } from '@/components/ui/Skeleton'
import { SettingsCard } from './SettingsUi'
import { cn } from '@/lib/cn'

const LEVEL = {
  ok: { bar: 'bg-[var(--success)]', text: 'Plenty of room.' },
  watch: { bar: 'bg-[var(--warning)]', text: 'Getting fuller — keep an eye on it.' },
  high: { bar: 'bg-[var(--danger)]', text: 'Almost full — free some space soon.' },
} as const

/** "5.2 MB", "512 MB", "820 KB", "1.1 GB" */
export function sizeLabel(bytes: number) {
  const one = (n: number) => n.toFixed(1).replace(/\.0$/, '')
  if (bytes >= 1024 ** 3) return `${one(bytes / 1024 ** 3)} GB`
  if (bytes >= 1024 ** 2) return `${one(bytes / 1024 ** 2)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** Admin → Settings → General: how full the database is, and what takes the room. */
export function StorageCard() {
  const storage = useQuery({
    queryKey: ['admin-storage'],
    queryFn: async () => (await adminApi.settings.storage()).data.data,
    staleTime: 5 * 60_000,
  })
  const s = storage.data

  return (
    <SettingsCard title="Storage" description="How full your database is (MongoDB), against your plan's limit.">
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
          <div
            className="h-2.5 overflow-hidden rounded-full bg-[var(--bg-muted)]"
            role="progressbar"
            aria-label="Database used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, s.percent)}
          >
            <div className={cn('h-full rounded-full', LEVEL[s.level].bar)} style={{ width: `${Math.min(100, Math.max(1, s.percent))}%` }} />
          </div>
          <p className="text-sm">{LEVEL[s.level].text}</p>

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
        </div>
      )}
    </SettingsCard>
  )
}
