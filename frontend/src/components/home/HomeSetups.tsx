import { Link } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useT } from '@/hooks/useT'
import { SETUP_ICON, SETUP_IDS } from '@/lib/setups'

/**
 * Home: "What will you use it for?" — the four setups as one row of small tiles (2×2 on phones),
 * each opening its setup page directly (/setups/gaming …). Another way in besides the header's
 * "Grab your setup" button, the menu and the footer.
 */
export function HomeSetups() {
  const t = useT()
  return (
    <section id="setups" aria-labelledby="home-setups-heading" className="py-3 sm:py-6">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="home-setups-heading" className="font-display text-lg font-semibold tracking-tight sm:text-3xl">
            {t('setups.title')}
          </h2>
          <Link to="/setups" className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-text)] hover:underline sm:text-sm">
            {t('common.setups')}
            <SiteIcon name="arrow-right" size={14} className="rtl:rotate-180" />
          </Link>
        </div>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3 lg:grid-cols-4">
          {SETUP_IDS.map((id) => (
            <li key={id}>
              <Link
                to={`/setups/${id}`}
                className="group flex h-full items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5 transition hover:-translate-y-0.5 hover:border-[var(--brand)] sm:gap-3 sm:rounded-2xl sm:p-4"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand-text)] transition group-hover:bg-[var(--brand)] group-hover:text-[var(--brand-fg)] sm:size-11 sm:rounded-xl">
                  <SiteIcon name={SETUP_ICON[id]} size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold sm:text-base">{t(`setups.${id}.name`)}</span>
                  <span className="hidden truncate text-xs text-[var(--fg-muted)] sm:block">{t(`setups.${id}.tagline`)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
