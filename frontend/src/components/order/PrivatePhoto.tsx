import { useQuery } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { cn } from '@/lib/cn'

/**
 * Deposit photos are private (never public URLs): they are fetched with the signed-in session and
 * shown from a local object URL.
 */
export function usePrivatePhoto(key: readonly unknown[], load: () => Promise<{ data: Blob }>, enabled = true) {
  return useQuery({
    queryKey: ['private-photo', ...key],
    queryFn: async () => URL.createObjectURL((await load()).data),
    enabled,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    retry: 1,
  })
}

/** Square thumbnail of a private photo; opens it large. */
export function PhotoTile({
  photoKey,
  load,
  label,
  sublabel,
  onOpen,
  onDelete,
  deleting,
  className,
}: {
  photoKey: readonly unknown[]
  load: () => Promise<{ data: Blob }>
  label?: string
  sublabel?: string
  onOpen: (url: string) => void
  onDelete?: () => void
  deleting?: boolean
  className?: string
}) {
  const photo = usePrivatePhoto(photoKey, load)
  return (
    <div className={cn('group relative', className)}>
      <button
        type="button"
        onClick={() => photo.data && onOpen(photo.data)}
        className="block aspect-square w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] transition hover:border-[var(--brand)]"
        aria-label={label ? `Open ${label}` : 'Open photo'}
      >
        {photo.data ? (
          <img src={photo.data} alt="" className="h-full w-full object-cover" />
        ) : photo.isError ? (
          <span className="flex h-full w-full items-center justify-center text-[var(--fg-muted)]">
            <SiteIcon name="alert" size={18} />
          </span>
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <Spinner />
          </span>
        )}
      </button>
      {label ? (
        <span className="pointer-events-none absolute inset-x-1 bottom-1 truncate rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {label}
          {sublabel ? <span className="block truncate text-[9px] font-normal text-white/75">{sublabel}</span> : null}
        </span>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          aria-label="Delete photo"
          className="absolute end-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-[var(--danger)] disabled:opacity-50"
        >
          {deleting ? <Spinner size="sm" /> : <SiteIcon name="trash" size={13} />}
        </button>
      ) : null}
    </div>
  )
}

/** Full-size view of a photo, with "open in a new tab" to zoom or save it. */
export function PhotoLightbox({ url, title, onClose, openLabel = 'Open full size' }: { url: string | null; title: string; onClose: () => void; openLabel?: string }) {
  return (
    <Modal open={Boolean(url)} onClose={onClose} title={title} size="md">
      {url ? (
        <div className="space-y-3">
          <img src={url} alt={title} className="max-h-[70vh] w-full rounded-lg bg-[var(--bg-muted)] object-contain" />
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand-text)] hover:underline">
            <SiteIcon name="external" size={13} /> {openLabel}
          </a>
        </div>
      ) : null}
    </Modal>
  )
}
