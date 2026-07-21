import { useToastStore } from '@/store/toastStore'
import { cn } from '@/lib/cn'
import { X } from 'lucide-react'

export function Toaster() {
  const { toasts, dismiss } = useToastStore()

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-soft-lg glass',
            t.type === 'success' && 'border-[var(--success)]',
            t.type === 'error' && 'border-[var(--danger)]',
            t.type === 'info' && 'border-[var(--border)]'
          )}
        >
          <p className="flex-1 text-sm">{t.message}</p>
          <button type="button" onClick={() => dismiss(t.id)} className="text-[var(--fg-muted)]">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
