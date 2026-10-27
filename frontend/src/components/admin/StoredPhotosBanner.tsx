import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { toast } from '@/store/toastStore'

/**
 * Admin → Products: photos uploaded before Cloudinary was set up are stored in the database and
 * load full size. Shown only while some exist; once the Cloudinary keys are set, one click moves
 * them there (a few products per request, until none are left).
 */
export function StoredPhotosBanner() {
  const qc = useQueryClient()
  const [progress, setProgress] = useState<{ moved: number; failed: number } | null>(null)
  const count = useQuery({
    queryKey: ['admin-stored-photos'],
    queryFn: async () => (await adminApi.products.movePhotos({ dryRun: true })).data.data,
    staleTime: 60_000,
  })

  const run = async () => {
    const skip: string[] = []
    let moved = 0
    let failed = 0
    setProgress({ moved, failed })
    try {
      for (let round = 0; round < 60; round++) {
        const r = (await adminApi.products.movePhotos({ skip })).data.data
        for (const p of r.processed) {
          moved += p.moved
          failed += p.failed
          if (p.failed) skip.push(p.key)
        }
        setProgress({ moved, failed })
        if (!r.remaining || !r.processed.length) break
      }
      qc.invalidateQueries({ queryKey: ['admin-stored-photos'] })
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
      if (failed) toast.info(`${moved} photo${moved === 1 ? '' : 's'} moved · ${failed} could not be moved (they still work, try again later)`)
      else toast.success(`${moved} photo${moved === 1 ? '' : 's'} moved to Cloudinary`)
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setProgress(null)
    }
  }

  const n = count.data?.photos ?? 0
  if (!n && !progress) return null
  const ready = Boolean(count.data?.cloudinary)

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--brand)_35%,transparent)] bg-[color-mix(in_srgb,var(--brand)_7%,transparent)] px-3 py-2.5 text-sm">
      <SiteIcon name="refresh" size={16} className="shrink-0 text-[var(--brand-text)]" />
      <p className="min-w-0 flex-1">
        <span className="font-medium">
          {n} photo{n === 1 ? '' : 's'} {n === 1 ? 'is' : 'are'} stored in your database.
        </span>{' '}
        <span className="text-[var(--fg-muted)]">
          {ready
            ? 'Move them to Cloudinary: lighter, resized photos on phones and more room in your database.'
            : 'To move them to Cloudinary (lighter photos on phones), add the Cloudinary keys in Vercel and redeploy first.'}
        </span>
      </p>
      {ready ? (
        <Button size="sm" loading={Boolean(progress)} onClick={run}>
          {progress ? `Moving… ${progress.moved}` : 'Move photos to Cloudinary'}
        </Button>
      ) : null}
    </div>
  )
}
