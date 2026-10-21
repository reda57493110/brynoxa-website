import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { toast } from '@/store/toastStore'

/**
 * Admin → Products: photos pasted from other websites load slowly and vanish when that site
 * changes. Shown only while some exist; one click copies them into our own photo storage
 * (a few products per request, until none are left).
 */
export function OutsidePhotosBanner() {
  const qc = useQueryClient()
  const [progress, setProgress] = useState<{ copied: number; failed: number } | null>(null)
  const count = useQuery({
    queryKey: ['admin-outside-photos'],
    queryFn: async () => (await adminApi.products.importPhotos({ dryRun: true })).data.data,
    staleTime: 60_000,
  })

  const run = async () => {
    const skip: string[] = []
    let copied = 0
    let failed = 0
    setProgress({ copied, failed })
    try {
      for (let round = 0; round < 50; round++) {
        const r = (await adminApi.products.importPhotos({ skip })).data.data
        for (const p of r.processed) {
          copied += p.copied
          failed += p.failed
          if (p.failed) skip.push(p.productId)
        }
        setProgress({ copied, failed })
        if (!r.remaining || !r.processed.length) break
      }
      qc.invalidateQueries({ queryKey: ['admin-outside-photos'] })
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      if (failed) toast.info(`${copied} photo${copied === 1 ? '' : 's'} copied · ${failed} could not be downloaded (kept as links)`)
      else toast.success(`${copied} photo${copied === 1 ? '' : 's'} copied into your storage`)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setProgress(null)
    }
  }

  const n = count.data?.photos ?? 0
  if (!n && !progress) return null

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--warning)_40%,transparent)] bg-[color-mix(in_srgb,var(--warning)_8%,transparent)] px-3 py-2.5 text-sm">
      <SiteIcon name="alert" size={16} className="shrink-0 text-[var(--warning)]" />
      <p className="min-w-0 flex-1">
        <span className="font-medium">
          {n} photo{n === 1 ? '' : 's'} on {count.data?.remaining ?? 0} product{count.data?.remaining === 1 ? '' : 's'} load from other websites.
        </span>{' '}
        <span className="text-[var(--fg-muted)]">They are slower and disappear if that website changes. Copy them into your own storage.</span>
      </p>
      <Button size="sm" loading={Boolean(progress)} onClick={run}>
        {progress ? `Copying… ${progress.copied}` : 'Copy into my storage'}
      </Button>
    </div>
  )
}
