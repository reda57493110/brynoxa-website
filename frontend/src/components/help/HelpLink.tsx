import { SiteIcon } from '@/components/ui/SiteIcon'
import { useHelpStore } from '@/store/helpStore'
import { cn } from '@/lib/cn'
import type { HelpGuideId } from '@/lib/help/types'

/**
 * A small, quiet link that opens a step-by-step guide right on the page (the Help button panel),
 * so the customer keeps their cart / checkout / order in view. `guide={null}` opens the list of guides.
 */
export function HelpLink({ guide, label, className }: { guide: HelpGuideId | null; label: string; className?: string }) {
  const open = useHelpStore((s) => s.open)
  return (
    <button
      type="button"
      onClick={() => open(guide)}
      aria-haspopup="dialog"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm text-start text-xs font-medium text-[var(--fg-muted)] transition hover:text-[var(--brand-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:text-[13px]',
        className
      )}
    >
      <SiteIcon name="help" size={14} className="text-[var(--brand-text)]" />
      {label}
    </button>
  )
}
