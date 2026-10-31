import { Link } from 'react-router-dom'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useT } from '@/hooks/useT'
import { cn } from '@/lib/cn'
import type { HelpQuickGuide } from '@/lib/help/types'

/** The main button of a guide, when the page knows better than the guide (e.g. "Go to checkout"). */
export type GuideAction = { label: string; to?: string; onClick?: () => void }

/**
 * One step-by-step guide ("How to order"…): numbered steps with an icon, a short note, and a button
 * to do it now. `wide`: steps side by side (Help Center page); otherwise a vertical list (Help panel).
 * `current`: the step the shopper is at (Help panel): earlier steps are ticked, this one stands out.
 */
export function QuickGuide({
  guide,
  wide = false,
  onNavigate,
  moreHref,
  current,
  action,
  hideIntro = false,
}: {
  guide: HelpQuickGuide
  wide?: boolean
  /** Called when a link inside is followed (the Help panel closes itself) */
  onNavigate?: () => void
  /** "More details" link, e.g. /help#place-order */
  moreHref?: string
  current?: number
  action?: GuideAction
  /** The intro is shown elsewhere (the Help panel header) */
  hideIntro?: boolean
}) {
  const t = useT()
  const main = action ?? { label: guide.action.label, to: guide.action.to }
  const mainClass =
    'inline-flex h-10 items-center gap-2 rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-[var(--brand-fg)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]'
  return (
    <div>
      {hideIntro ? null : (
        <p className={cn('text-[var(--fg-muted)]', wide ? 'text-sm sm:text-base' : 'text-sm')}>{guide.intro}</p>
      )}

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
            (() => {
              const done = current !== undefined && i < current
              const here = current === i
              const last = i === guide.steps.length - 1
              return (
                <li
                  key={step.title}
                  aria-current={here ? 'step' : undefined}
                  className={cn('relative flex gap-3 pb-3 last:pb-0', here && 'z-[1]')}
                >
                  {/* the line joining the steps: coloured up to the step the shopper is at */}
                  {!last ? (
                    <span
                      className={cn(
                        'absolute start-[1.125rem] top-9 bottom-0 w-0.5 rounded-full',
                        done ? 'bg-[var(--brand)]' : 'bg-[var(--border)]'
                      )}
                      aria-hidden="true"
                    />
                  ) : null}
                  <span
                    className={cn(
                      'relative grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold transition',
                      done
                        ? 'bg-[var(--brand)] text-[var(--brand-fg)]'
                        : here
                          ? 'bg-[var(--bg-elevated)] text-[var(--brand-text)] ring-2 ring-[var(--brand)] ring-offset-2 ring-offset-[var(--bg-elevated)]'
                          : 'bg-[var(--bg-muted)] text-[var(--fg-muted)]'
                    )}
                    aria-hidden="true"
                  >
                    {done ? <SiteIcon name="check" size={16} /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 flex-1 rounded-xl',
                      here ? 'bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] px-3 py-2' : 'pt-1.5'
                    )}
                  >
                    <span className="sr-only">
                      {t('help.step', { n: i + 1 })}
                      {done ? ` (${t('help.stepDone')})` : ''}:{' '}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <SiteIcon
                        name={step.icon}
                        size={15}
                        className={cn('shrink-0', done || here ? 'text-[var(--brand-text)]' : 'text-[var(--fg-muted)]')}
                      />
                      <span className={cn('text-sm font-semibold', done ? 'text-[var(--fg-muted)]' : 'text-[var(--fg)]')}>
                        {step.title}
                      </span>
                      {here ? (
                        <span className="rounded-full bg-[var(--brand)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--brand-fg)]">
                          {t('help.youAreHere')}
                        </span>
                      ) : null}
                    </span>
                    {done ? null : (
                      <span className="mt-0.5 block text-[13px] leading-relaxed text-[var(--fg-muted)]">{step.text}</span>
                    )}
                  </span>
                </li>
              )
            })()
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
        {main.to ? (
          <Link to={main.to} onClick={onNavigate} className={mainClass}>
            {main.label}
            <SiteIcon name="arrow-right" size={15} className="rtl:rotate-180" />
          </Link>
        ) : (
          <button type="button" onClick={main.onClick} className={mainClass}>
            {main.label}
          </button>
        )}
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
