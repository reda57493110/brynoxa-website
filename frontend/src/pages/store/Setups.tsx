import { Link, useNavigate, useParams } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { ProductCard } from '@/components/product/ProductCard'
import { ProductCarousel } from '@/components/product/ProductCarousel'
import { useSetupLists } from '@/hooks/useSetupLists'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useT } from '@/hooks/useT'
import { useSeo } from '@/hooks/useSeo'
import { useLocaleStore } from '@/store/localeStore'
import { cn } from '@/lib/cn'
import { SETUP_ICON, SETUP_IDS, isSetupId, type SetupId, type SetupPiece } from '@/lib/setups'

// Written out in full so Tailwind keeps them (index = how many columns)
const SPAN_SM = ['', 'sm:col-span-1', 'sm:col-span-2']
const SPAN_LG = ['', 'lg:col-span-1', 'lg:col-span-2', 'lg:col-span-3', 'lg:col-span-4']
const INNER_SM = ['', 'sm:grid-cols-1', 'sm:grid-cols-2']
const INNER_LG = ['', 'lg:grid-cols-1', 'lg:grid-cols-2', 'lg:grid-cols-3', 'lg:grid-cols-4']

/**
 * "Pick your setup" (/setups, /setups/gaming …): the customer picks what the computer is for
 * (gaming, study, work, streaming & creation) and sees only what goes with it, grouped by part
 * (computer, screen, mouse / keyboard / headset, components, cameras, accessories). In stock only.
 * Which products: hooks/useSetupLists.ts (chosen in Admin → Products, or automatic: lib/setups.ts).
 */
/** The category most of a group's products are in (its 'See all' opens it in the shop) */
function mainCategoryOf(items: { category?: unknown }[]) {
  const counts = new Map<string, number>()
  for (const p of items) {
    const slug = p.category && typeof p.category === 'object' ? (p.category as { slug?: string }).slug : undefined
    if (slug) counts.set(slug, (counts.get(slug) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
}

export function Setups() {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const navigate = useNavigate()
  const { kind } = useParams()
  const isPhone = !useMediaQuery('(min-width: 640px)')
  const active: SetupId = isSetupId(kind) ? kind : 'gaming'
  const amount = (n: number) => new Intl.NumberFormat(locale === 'ar' ? 'ar-MA' : locale === 'fr' ? 'fr-MA' : 'en-US').format(n)

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
          <p className="kicker inline-flex items-center gap-1.5">
            <SiteIcon name="layers" size={13} />
            {t('setups.kicker')}
          </p>
          <h1 id="setups-heading" className="mt-1.5 font-display text-2xl font-semibold tracking-tight sm:mt-2 sm:text-5xl">
            {t('setups.title')}
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--fg-muted)] sm:mt-3 sm:text-base">{t('setups.body')}</p>
        </div>

        {/* The setups: tap one to see what goes with it */}
        <div role="tablist" aria-label={t('setups.kicker')} className="mt-4 grid grid-cols-4 gap-1.5 sm:mt-8 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
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
                  'group relative flex min-w-0 flex-col items-center gap-1.5 overflow-hidden rounded-xl border px-1 py-2.5 text-center transition sm:items-start sm:gap-3 sm:rounded-2xl sm:p-5 sm:text-start',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
                  on
                    ? 'border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_12%,var(--bg))] shadow-glow'
                    : 'border-[var(--border)] bg-[var(--bg-elevated)] hover:-translate-y-0.5 hover:border-[var(--brand)]'
                )}
              >
                <span
                  className={cn(
                    'grid size-8 place-items-center rounded-lg transition sm:size-12 sm:rounded-xl',
                    on ? 'bg-[var(--brand)] text-[var(--brand-fg)]' : 'bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] text-[var(--brand-text)]'
                  )}
                >
                  <SiteIcon name={SETUP_ICON[id]} size={isPhone ? 16 : 20} />
                </span>
                <span className="min-w-0 max-w-full">
                  <span className="line-clamp-2 block font-display text-[11px] font-semibold leading-tight sm:text-xl">{t(`setups.${id}.name`)}</span>
                  <span className="mt-1 hidden text-xs leading-snug text-[var(--fg-muted)] sm:block sm:text-sm">{t(`setups.${id}.tagline`)}</span>
                  <span className="mt-0.5 block text-[10px] font-semibold text-[var(--brand-text)] sm:mt-2 sm:text-xs">
                    {n === undefined ? '…' : t(n === 1 ? 'setups.countOne' : 'setups.count', { count: n })}
                  </span>
                </span>
                {on ? <SiteIcon name="check" size={16} className="absolute end-3 top-3 hidden text-[var(--brand-text)] sm:block" /> : null}
              </button>
            )
          })}
        </div>

        {/* The chosen setup */}
        <div id="setup-panel" role="tabpanel" className="mt-4 rounded-[1.25rem] border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-soft sm:mt-8 sm:rounded-[2rem] sm:p-7">
          <div className="flex flex-wrap items-start gap-3 sm:gap-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] shadow-glow sm:size-14 sm:rounded-2xl">
              <SiteIcon name={SETUP_ICON[active]} size={isPhone ? 18 : 24} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-semibold leading-tight tracking-tight sm:text-3xl">{t(`setups.${active}.name`)}</h2>
              <p className="mt-0.5 max-w-2xl text-[12.5px] leading-snug text-[var(--fg-muted)] sm:mt-1 sm:text-base sm:leading-relaxed">{t(`setups.${active}.intro`)}</p>
            </div>
          </div>

          {groups.length ? (
            <nav aria-label={t('setups.inside')} className="mt-3 sm:mt-5">
              <p className="hidden text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)] sm:block">{t('setups.inside')}</p>
              <ul className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:mt-2 sm:flex-wrap sm:gap-2 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
                {groups.map((g) => (
                  <li key={g.piece} className="shrink-0">
                    <a
                      href={`#${pieceId(g.piece)}`}
                      className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--border)] bg-[var(--bg)] px-3 text-[11px] font-semibold transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] sm:h-9 sm:px-3.5 sm:text-sm"
                    >
                      {t(`setups.groups.${active}.${g.piece}`)}
                      <span className="rounded-full bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] px-1.5 text-[11px] text-[var(--brand-text)]">{g.items.length}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          {current.pending ? (
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4" aria-hidden>
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="h-72 animate-pulse rounded-2xl bg-[var(--bg-muted)]" />
              ))}
            </div>
          ) : !groups.length ? (
            <div className="mt-6 rounded-2xl border border-dashed border-[var(--border)] p-8 text-center">
              <p className="text-sm text-[var(--fg-muted)]">{t('setups.empty')}</p>
              <Link to="/shop" className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-[var(--brand)] px-5 text-sm font-semibold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110">
                {t('setups.browseAll')}
                <SiteIcon name="arrow-right" size={16} className="rtl:rotate-180" />
              </Link>
            </div>
          ) : (
            // Groups side by side, each as wide as its products (a group of 1 takes 1 column), gaps filled
            <div className="mt-3 grid grid-cols-1 gap-3 [grid-auto-flow:row_dense] sm:mt-5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
              {groups.map((g) => {
                const n = g.items.length
                return (
                  <div
                    key={`${active}-${g.piece}`}
                    id={pieceId(g.piece)}
                    className={cn('min-w-0 scroll-mt-24 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2.5 sm:rounded-2xl sm:p-4', SPAN_SM[Math.min(n, 2)], SPAN_LG[Math.min(n, 4)])}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2 sm:mb-3">
                      <div className="min-w-0">
                        <h3 className="font-display text-[15px] font-semibold leading-tight sm:text-lg">{t(`setups.groups.${active}.${g.piece}`)}</h3>
                        <p className="mt-0.5 text-[11px] text-[var(--fg-muted)] sm:text-xs">
                          {t(n === 1 ? 'setups.countOne' : 'setups.count', { count: n })} · {t('setups.from', { price: amount(Math.min(...g.items.map((p) => p.price))) })}
                        </p>
                      </div>
                      {/* More of this kind in the shop (its category) */}
                      <Link
                        to={mainCategoryOf(g.items) ? `/shop?category=${mainCategoryOf(g.items)}` : '/shop'}
                        aria-label={`${t('setups.seeAll')}: ${t(`setups.groups.${active}.${g.piece}`)}`}
                        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-[var(--border)] px-2.5 text-[11px] font-semibold text-[var(--brand-text)] transition hover:border-[var(--brand)] sm:h-8 sm:text-xs"
                      >
                        {t('setups.seeAll')}
                        <SiteIcon name="arrow-right" size={12} className="rtl:rotate-180" />
                      </Link>
                    </div>
                    {isPhone && n > 1 ? (
                      <ProductCarousel products={g.items} size="md" />
                    ) : (
                      // Phones: one product stays card-sized (not the whole width)
                      <div className={cn('grid grid-cols-1 gap-3 max-sm:w-[min(14rem,62vw)] sm:gap-4', INNER_SM[Math.min(n, 2)], INNER_LG[Math.min(n, 4)])}>
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

          {groups.length ? (
            <div className="mt-4 flex flex-col items-start gap-3 rounded-xl border border-dashed border-[color-mix(in_srgb,var(--brand)_45%,var(--border))] bg-[color-mix(in_srgb,var(--brand)_6%,var(--bg))] p-3 sm:mt-6 sm:flex-row sm:items-center sm:justify-between sm:rounded-2xl sm:p-5">
              <div className="min-w-0">
                <p className="font-display text-[15px] font-semibold sm:text-lg">{t('setups.moreTitle')}</p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--fg-muted)] sm:text-sm">{t('setups.moreBody')}</p>
              </div>
              <Link
                to="/shop"
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-[var(--brand)] px-5 text-sm font-semibold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 sm:h-11"
              >
                <SiteIcon name="layers" size={15} />
                {t('setups.moreCta')}
                <SiteIcon name="arrow-right" size={15} className="rtl:rotate-180" />
              </Link>
            </div>
          ) : null}
        </div>

        {/* Not sure? */}
        <div className="mt-6 flex flex-col items-start gap-4 rounded-[1.5rem] border border-[color-mix(in_srgb,var(--brand)_35%,var(--border))] bg-[radial-gradient(80%_120%_at_0%_0%,color-mix(in_srgb,var(--brand)_14%,transparent),transparent_60%)] bg-[var(--bg-elevated)] p-4 sm:mt-8 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="max-w-xl">
            <h2 className="font-display text-base font-semibold sm:text-2xl">{t('setups.helpTitle')}</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--fg-muted)] sm:text-sm">{t('setups.helpBody')}</p>
          </div>
          <Link to="/contact" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-[var(--brand)] px-5 text-sm sm:h-11 font-semibold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110">
            <SiteIcon name="chat" size={16} />
            {t('setups.helpCta')}
          </Link>
        </div>
      </Container>
    </section>
  )
}
