import { Link } from 'react-router-dom'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { formatDateTime } from '@/lib/format'
import type { CustomerTimelineEvent } from '@/types'
import { Section } from './shared'

function iconFor(type: string): SiteIconName {
  if (type === 'registered') return 'user'
  if (type === 'order') return 'cart'
  if (type === 'order-update') return 'truck'
  if (type === 'payment') return 'banknote'
  if (type.includes('wholesale')) return 'tag'
  if (type.includes('email')) return 'mail'
  if (type.includes('note')) return 'pencil'
  if (type.includes('disable') || type.includes('enable') || type.includes('status')) return 'shield'
  return 'clock'
}

export function ProfileActivity({ timeline }: { timeline: CustomerTimelineEvent[] }) {
  return (
    <Section title="Activity">
      {timeline.length ? (
        <ol className="relative space-y-4 border-l border-[var(--border)] pl-5">
          {timeline.map((e, i) => (
            <li key={`${e.at}-${i}`} className="relative min-w-0">
              <span className="absolute top-0.5 -left-[1.95rem] flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--brand-text)]">
                <SiteIcon name={iconFor(e.type)} size={12} />
              </span>
              <p className="text-sm font-medium break-words">
                {e.orderId ? (
                  <Link to={`/admin/orders/${e.orderId}`} className="hover:text-[var(--brand-text)]">
                    {e.title}
                  </Link>
                ) : (
                  e.title
                )}
              </p>
              {e.detail ? <p className="text-sm break-words text-[var(--fg-muted)]">{e.detail}</p> : null}
              <time dateTime={e.at} className="text-xs text-[var(--fg-muted)]">
                {formatDateTime(e.at)}
              </time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-[var(--fg-muted)]">No activity yet.</p>
      )}
    </Section>
  )
}
