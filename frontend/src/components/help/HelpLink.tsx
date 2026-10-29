import { Link } from 'react-router-dom'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { cn } from '@/lib/cn'

/** A small, quiet link to one Help Center topic (/help#topic), for pages where a question is likely. */
export function HelpLink({ topic, label, className }: { topic: string; label: string; className?: string }) {
  return (
    <Link
      to={`/help#${topic}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm text-xs font-medium text-[var(--fg-muted)] transition hover:text-[var(--brand-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:text-[13px]',
        className
      )}
    >
      <SiteIcon name="help" size={14} />
      {label}
    </Link>
  )
}
