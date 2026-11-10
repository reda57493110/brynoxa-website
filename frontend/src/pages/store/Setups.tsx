import { Link, useNavigate, useParams } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { ProductCard } from '@/components/product/ProductCard'
import { ProductCarousel } from '@/components/product/ProductCarousel'
import { useSetupLists } from '@/hooks/useSetupLists'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useT } from '@/hooks/useT'
import { useSeo } from '@/hooks/useSeo'
import { cn } from '@/lib/cn'
import { SETUP_ICON, SETUP_IDS, isSetupId, type SetupId, type SetupPiece } from '@/lib/setups'

// Written out in full so Tailwind keeps them (index = how many columns)
const SPAN_SM = ['', 'sm:col-span-1', 'sm:col-span-2']
const SPAN_LG = ['', 'lg:col-span-1', 'lg:col-span-2', 'lg:col-span-3', 'lg:col-span-4']
const INNER_SM = ['', 'sm:grid-cols-1', 'sm:grid-cols-2']
const INNER_LG = ['', 'lg:grid-cols-1', 'lg:grid-cols-2', 'lg:grid-cols-3', 'lg:grid-cols-4']

/** The category most of a group's products are in (its "See all" opens it in the shop) */
function mainCategoryOf(items: { category?: unknown }[]) {
  const counts = new Map<string, number>()
  for (const p of items) {
    const slug = p.category && typeof p.category === 'object' ? (p.category as { slug?: string }).slug : undefined
    if (slug) counts.set(slug, (counts.get(slug) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
}

/**
 * "Pick your setup" (/setups, /setups/gaming …): the customer picks what the computer is for
 * (gaming, study, work, streaming & creation) and sees only what goes with it, grouped by kind
 * (Gaming PCs, Gaming mice…). Kept simple on purpose: a title, two reassurances, the four setups,
 * then the products — no boxes around groups, no repeated texts. In stock only.
 * Which products: hooks/useSetupLists.ts (chosen in Admin → Products, or automatic: lib/setups.ts).
 */
export function Setups() {
  const t = useT()
  const navigate = useNavigate()
  const { kind } = useParams()
  const isPhone = !useMediaQuery('(min-width: 640px)')
  const active: SetupId = isSetupId(kind) ? kind : 'gaming'

  // Every setup at once: the tiles show how many products each has
  const byId = useSetupLists()
  const current = byId[active]
  const groups = current.groups

  useSeo({
    title: `${t(`setups.${active}.name`)} · ${t('setups.metaTitle')}`,
    description: t(`setups.${active}.intro`),
    path: kind ? `/setups/${active}` : '/setups',
  })

  const pick = (id: SetupId) => navigate(`/setups/${id}`, { replace: true, state: { keepScroll: true } })
  const pieceId = (piece: SetupPiece) => `setup-${piece}`

  return (
    <section aria-labelledby="setups-heading" className="pb-12 pt-6 sm:pb-16 sm:pt-10">
      <Container>
        <div className="max-w-2xl">
          <h1 id="setups-heading" className="font-display text-2xl font-semibold tracking-tight sm:text-4xl">
            {t('setups.title')}
          </h1>
          <p className="mt-1.5 text-[13px] text-[var(--fg-muted)] sm:mt-2 sm:text-base">{t('setups.short')}</p>
          {/* What makes it safe to order */}
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] font-medium text-[var(--fg-muted)] sm:text-sm">
            <li className="inline-flex items-center gap-1.5">
              <SiteIcon name="banknote" size={14} className="text-[var(--brand-text)]" />
              {t('home.heroPerkCod')}
            </li>
          </ul>
        </div>

        {/* The setups: tap one to see what goes with it */}
        <div role="tablist" aria-label={t('setups.kicker')} className="mt-5 grid grid-cols-4 gap-1.5 sm:mt-7 sm:gap-3">
          {SETUP_IDS.map((id) => {
            const on = id === active
            const n = byId[id].pending ? undefined : byId[id].items.length
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="setup-panel"
                onClick={() => pick(id)}
                className={cn(
                  'flex min-w-0 flex-col items-center gap-1.5 rounded-xl border px-1 py-2.5 text-center transition sm:flex-row sm:gap-3 sm:px-4 sm:py-3 sm:text-start',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
                  on
                    ? 'border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_10%,var(--bg))]'
                    : 'border-[var(--border)] bg-[var(--bg-elevated)] hover:border-[var(--brand)]'
                )}
              >
                <span
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-lg sm:size-10',
                    on ? 'bg-[var(--brand)] text-[var(--brand-fg)]' : 'bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] text-[var(--brand-text)]'
                  )}
                >
                  <SiteIcon name={SETUP_ICON[id]} size={isPhone ? 16 : 18} />
                </span>
                <span className="min-w-0 max-w-full">
                  <span className="line-clamp-2 block text-[11px] font-semibold leading-tight sm:text-[15px]">{t(`setups.${id}.name`)}</span>
                  <span className="mt-0.5 block text-[10px] text-[var(--fg-muted)] sm:text-xs">
                    {n === undefined ? '…' : t(n === 1 ? 'setups.countOne' : 'setups.count', { count: n })}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        {/* The chosen setup: its products, kind by kind */}
        <div id="setup-panel" role="tabpanel" className="mt-6 sm:mt-8">
          {current.pending ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-hidden>
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="h-72 animate-pulse rounded-2xl bg-[var(--bg-muted)]" />
              ))}
            </div>
          ) : !groups.length ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center">
              <p className="text-sm text-[var(--fg-muted)]">{t('setups.empty')}</p>
              <Link to="/shop" className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-[var(--brand)] px-5 text-sm font-semibold text-[var(--brand-fg)] transition hover:brightness-110">
                {t('setups.browseAll')}
                <SiteIcon name="arrow-right" size={16} className="rtl:rotate-180" />
              </Link>
            </div>
          ) : (
            // Groups side by side on computers, each as wide as its products; no box around them
            <div className="grid grid-cols-1 gap-x-6 gap-y-7 [grid-auto-flow:row_dense] sm:grid-cols-2 sm:gap-y-9 lg:grid-cols-4">
              {groups.map((g) => {
                const n = g.items.length
                const slug = mainCategoryOf(g.items)
                return (
                  <div key={`${active}-${g.piece}`} id={pieceId(g.piece)} className={cn('min-w-0 scroll-mt-24', SPAN_SM[Math.min(n, 2)], SPAN_LG[Math.min(n, 4)])}>
                    <div className="mb-2.5 flex items-center justify-between gap-2 sm:mb-3">
                      <h2 className="font-display text-base font-semibold leading-tight sm:text-lg">{t(`setups.groups.${active}.${g.piece}`)}</h2>
                      <Link
                        to={slug ? `/shop?category=${slug}` : '/shop'}
                        aria-label={`${t('setups.seeAll')}: ${t(`setups.groups.${active}.${g.piece}`)}`}
                        className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--brand-text)] hover:underline sm:text-sm"
                      >
                        {t('setups.seeAll')}
                        <SiteIcon name="arrow-right" size={13} className="rtl:rotate-180" />
                      </Link>
                    </div>
                    {isPhone && n > 1 ? (
                      <ProductCarousel products={g.items} size="sm" />
                    ) : (
                      // Phones: a group with one product shows it bigger, in the middle of the screen
                      <div className={cn('grid grid-cols-1 gap-3 max-sm:mx-auto max-sm:w-[min(17rem,80vw)] sm:gap-4', INNER_SM[Math.min(n, 2)], INNER_LG[Math.min(n, 4)])}>
                        {g.items.map((p, i) => (
                          <div key={p._id} className="h-full" data-rise="card" style={{ animationDelay: `${Math.min(i, 7) * 40}ms` }}>
                            <ProductCard product={p} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* More products, and help: one button and one line */}
        {groups.length ? (
          <div className="mt-8 flex flex-col items-center gap-3 border-t border-[var(--border)] pt-6 text-center sm:mt-10">
            <Link
              to="/shop"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--brand)] px-6 text-sm font-semibold text-[var(--brand-fg)] transition hover:brightness-110"
            >
              {t('setups.moreCta')}
              <SiteIcon name="arrow-right" size={15} className="rtl:rotate-180" />
            </Link>
            <p className="text-[13px] text-[var(--fg-muted)]">
              {t('setups.helpTitle')}{' '}
              <Link to="/contact" className="font-semibold text-[var(--brand-text)] hover:underline">
                {t('setups.helpCta')}
              </Link>
            </p>
          </div>
        ) : null}
      </Container>
    </section>
  )
}
