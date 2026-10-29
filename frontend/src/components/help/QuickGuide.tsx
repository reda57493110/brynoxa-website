import { Link } from 'react-router-dom'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useT } from '@/hooks/useT'
import { cn } from '@/lib/cn'
import type { HelpQuickGuide } from '@/lib/help/types'

/**
 * One step-by-step guide ("How to order"…): numbered steps with an icon, a short note, and a button
 * to do it now. `wide`: steps side by side (Help Center page); otherwise a vertical list (Help panel).
 */
export function QuickGuide({
  guide,
  wide = false,
  onNavigate,
  moreHref,
}: {
  guide: HelpQuickGuide
  wide?: boolean
  /** Called when a link inside is followed (the Help panel closes itself) */
  onNavigate?: () => void
  /** "More details" link, e.g. /help#place-order */
  moreHref?: string
}) {
  const t = useT()
  return (
    <div>
      <p className={cn('text-[var(--fg-muted)]', wide ? 'text-sm sm:text-base' : 'text-sm')}>{guide.intro}</p>

      <ol
        className={cn(
          'mt-4',
          wide
            ? cn('grid gap-3 sm:grid-cols-2', guide.steps.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4')
            : 'relative'
        )}
      >
        {guide.steps.map((step, i) =>
          wide ? (
            <li
              key={step.title}
              className="relative flex gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-4 sm:flex-col sm:gap-2.5"
            >
              <span className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand-text)]">
                <SiteIcon name={step.icon} size={20} />
                <span
                  className="absolute -end-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-[var(--brand)] text-[11px] font-bold text-[var(--brand-fg)]"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
              </span>
              <span className="min-w-0">
                <span className="sr-only">{t('help.step', { n: i + 1 })}: </span>
                <span className="block font-display text-[15px] font-semibold text-[var(--fg)]">{step.title}</span>
                <span className="mt-0.5 block text-sm leading-relaxed text-[var(--fg-muted)]">{step.text}</span>
              </span>
            </li>
          ) : (
            <li key={step.title} className="relative flex gap-3 pb-4 last:pb-0">
              {/* the line joining the steps */}
              {i < guide.steps.length - 1 ? (
                <span className="absolute start-[1.125rem] top-10 bottom-0 w-px bg-[var(--border)]" aria-hidden="true" />
              ) : null}
              <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand-text)]">
                <SiteIcon name={step.icon} size={17} />
                <span
                  className="absolute -end-1 -top-1 grid size-[1.125rem] place-items-center rounded-full bg-[var(--brand)] text-[10px] font-bold text-[var(--brand-fg)]"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
              </span>
              <span className="min-w-0 pt-0.5">
                <span className="sr-only">{t('help.step', { n: i + 1 })}: </span>
                <span className="block text-sm font-semibold text-[var(--fg)]">{step.title}</span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-[var(--fg-muted)]">{step.text}</span>
              </span>
            </li>
          )
        )}
      </ol>

      {guide.note ? (
        <p className="mt-4 flex gap-2 rounded-xl bg-[var(--bg-muted)] px-3 py-2.5 text-[13px] leading-relaxed text-[var(--fg)] sm:text-sm">
          <SiteIcon name="help" size={16} className="mt-0.5 text-[var(--brand-text)]" />
          <span>{guide.note}</span>
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          to={guide.action.to}
          onClick={onNavigate}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-[var(--brand-fg)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
        >
          {guide.action.label}
          <SiteIcon name="arrow-right" size={15} className="rtl:rotate-180" />
        </Link>
        {moreHref ? (
          <Link
            to={moreHref}
            onClick={onNavigate}
            className="text-sm font-medium text-[var(--brand-text)] hover:underline"
          >
            {t('help.moreDetails')}
          </Link>
        ) : null}
      </div>
    </div>
  )
}
