import { SiteIcon } from '@/components/ui/SiteIcon'
import { usePush } from '@/hooks/usePush'
import { useT } from '@/hooks/useT'
import { cn } from '@/lib/cn'

/** Footer control so shoppers who chose "Not now" can still opt in (or out) later. */
export function PushToggle({ className }: { className?: string }) {
  const t = useT()
  const { status, ready, busy, enable, disable } = usePush()

  if (!ready || status === 'unsupported' || status === 'denied') return null

  const subscribed = status === 'subscribed'

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void (subscribed ? disable() : enable())}
      title={subscribed ? t('push.turnOff') : undefined}
      className={cn('inline-flex items-center gap-2 disabled:opacity-60', className)}
    >
      <SiteIcon name="bell" size={14} className="shrink-0 text-[var(--brand-text)]" />
      <span className="truncate">{subscribed ? t('push.enabledLabel') : t('push.enable')}</span>
    </button>
  )
}
