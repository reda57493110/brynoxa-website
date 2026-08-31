import { useToastStore } from '@/store/toastStore'
import { cn } from '@/lib/cn'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'

const iconByType: Record<'success' | 'error' | 'info', SiteIconName> = {
  success: 'check',
  error: 'alert',
  info: 'inbox',
}

export function Toaster() {
  const { toasts, dismiss } = useToastStore()

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[100] flex flex-col items-center gap-2 px-3"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.type === 'error' ? 'alert' : 'status'}
          aria-live={t.type === 'error' ? 'assertive' : 'polite'}
          className={cn(
            'pointer-events-auto flex max-w-[min(22rem,calc(100vw-1.5rem))] items-center gap-2 rounded-full border px-3 py-2 text-sm shadow-soft backdrop-blur-md toast-enter',
            t.type === 'success' &&
              'border-[color-mix(in_srgb,var(--success)_35%,var(--border))] bg-[color-mix(in_srgb,var(--success)_12%,var(--bg-elevated))] text-[var(--fg)]',
            t.type === 'error' &&
              'border-[color-mix(in_srgb,var(--danger)_35%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_12%,var(--bg-elevated))] text-[var(--fg)]',
            t.type === 'info' &&
              'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg)]'
          )}
        >
          <span
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
              t.type === 'success' && 'bg-[color-mix(in_srgb,var(--success)_22%,transparent)] text-[var(--success)]',
              t.type === 'error' && 'bg-[color-mix(in_srgb,var(--danger)_22%,transparent)] text-[var(--danger)]',
              t.type === 'info' && 'bg-[var(--bg-muted)] text-[var(--fg-muted)]'
            )}
          >
            <SiteIcon name={iconByType[t.type]} size={14} />
          </span>
          <p className="min-w-0 flex-1 truncate font-medium leading-snug">{t.message}</p>
          <button
            type="button"
            onClick={() => dismiss(t.id)}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--fg-muted)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
            aria-label="Dismiss"
          >
            <SiteIcon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
