import { Link, useNavigate, useParams } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { Skeleton } from '@/components/ui/Skeleton'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { HomeSectionHead, HomeShelf } from '@/components/home/HomeShelf'
import { HomeShopCard } from '@/components/home/HomeShopCard'
import { HomeHelpBand } from '@/components/home/HomeBlocks'
import { useSetupLists } from '@/hooks/useSetupLists'
import { useT } from '@/hooks/useT'
import { useSeo } from '@/hooks/useSeo'
import { brandName } from '@/lib/brand'
import { cn } from '@/lib/cn'
import { SETUP_ICON, SETUP_IDS, isSetupId, type SetupId, type SetupPiece } from '@/lib/setups'

/** The category most of a group's products are in (its "See all" opens that category page) */
function mainCategoryOf(items: { category?: unknown }[]) {
  const counts = new Map<string, number>()
  for (const p of items) {
    const slug = p.category && typeof p.category === 'object' ? (p.category as { slug?: string }).slug : undefined
    if (slug) counts.set(slug, (counts.get(slug) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
}

const panel = 'rounded-[1.25rem] border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5 sm:rounded-[2rem] sm:p-6 lg:p-7'

/**
 * "Pick your setup" (/setups, /setups/gaming …), in the same look as the home page and the shop:
 * the path, a dark Brynoxa band with the title and the four setups (how many products each), then
 * the chosen setup's products kind by kind (Gaming PCs, Gaming mice…), each in its own panel with
 * the shop's cards in a row you swipe, and the WhatsApp help band. In stock only.
 * Which products: hooks/useSetupLists.ts (chosen in Admin → Products, or automatic: lib/setups.ts).
 */
export function Setups() {
  const t = useT()
  const navigate = useNavigate()
  const { kind } = useParams()
  const active: SetupId = isSetupId(kind) ? kind : 'gaming'

  // Every setup at once: the buttons show how many products each has
  const byId = useSetupLists()
  const current = byId[active]
  const groups = current.groups

  useSeo({
    title: `${t(`setups.${active}.name`)} · ${t('setups.metaTitle')} — ${brandName()}`,
    // Intro + our promises: long enough for Google's snippet
    description: `${t(`setups.${active}.intro`)} ${t('setups.metaPromise')}`,
    path: kind ? `/setups/${active}` : '/setups',
  })

  const pick = (id: SetupId) => navigate(`/setups/${id}`, { replace: true, state: { keepScroll: true } })
  const pieceId = (piece: SetupPiece) => `setup-${piece}`

  return (
    <div className="pb-10 pt-2 sm:pb-14 sm:pt-4">
      <Container>
        {/* Path: Home › Setups › Gaming */}
        <nav aria-label={t('shop.breadcrumb')} className="mb-2.5 sm:mb-3">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-[var(--fg-muted)] sm:text-[13px]">
            <li>
              <Link to="/" className="hover:text-[var(--brand-text)]">
                {t('common.home')}
              </Link>
            </li>
            <li className="inline-flex items-center gap-1">
              <SiteIcon name="chevron-right" size={12} className="opacity-60 rtl:rotate-180" />
              <span>{t('common.setups')}</span>
            </li>
            <li className="inline-flex items-center gap-1">
              <SiteIcon name="chevron-right" size={12} className="opacity-60 rtl:rotate-180" />
              <span aria-current="page" className="font-semibold uppercase text-[var(--fg)]">
                {t(`setups.${active}.name`)}
              </span>
            </li>
          </ol>
        </nav>

        {/* The band: title and the four setups (same look as the home "Find your next setup") */}
        <section aria-labelledby="setups-heading" className="relative isolate overflow-hidden rounded-[1.25rem] border border-[rgb(0_194_255/0.3)] bg-[#05080b] p-3.5 text-white sm:rounded-[2rem] sm:p-8 lg:p-10">
          <span className="absolute inset-0 -z-10 bg-[radial-gradient(60%_90%_at_100%_0%,rgb(0_194_255/0.25),transparent_60%),radial-gradient(50%_80%_at_0%_100%,rgb(0_194_255/0.12),transparent_60%)]" aria-hidden="true" />
          <span
            className="absolute inset-0 -z-10 opacity-[0.06] [background-image:linear-gradient(rgb(255_255_255)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255)_1px,transparent_1px)] [background-size:40px_40px]"
            aria-hidden="true"
          />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--brand)] sm:text-xs">{t('home.setupsBandKicker')}</p>
          <h1 id="setups-heading" className="text-white mt-1 font-display text-lg font-black uppercase leading-tight tracking-tight sm:mt-1.5 sm:text-4xl">
            {t('setups.title')}
          </h1>
          <p className="mt-1 max-w-xl text-[12px] text-white/70 sm:mt-1.5 sm:text-base">{t('setups.short')}</p>

          <div role="tablist" aria-label={t('setups.kicker')} className="mt-3 grid grid-cols-2 gap-1.5 sm:mt-7 sm:gap-3 lg:grid-cols-4">
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
                    'group flex min-w-0 items-center gap-2.5 rounded-xl border p-2.5 text-start transition sm:gap-3.5 sm:rounded-2xl sm:p-4',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
                    on
                      ? 'border-[var(--brand)] bg-[rgb(0_194_255/0.16)] shadow-[inset_0_-3px_0_var(--brand)]'
                      : 'border-white/12 bg-white/[0.04] hover:border-[var(--brand)] hover:bg-[rgb(0_194_255/0.1)]'
                  )}
                >
                  <span
                    className={cn(
                      'grid size-8 shrink-0 place-items-center rounded-lg transition sm:size-12 sm:rounded-xl',
                      on ? 'bg-[var(--brand)] text-[var(--brand-fg)]' : 'bg-[rgb(0_194_255/0.16)] text-[var(--brand)] group-hover:bg-[var(--brand)] group-hover:text-[var(--brand-fg)]'
                    )}
                  >
                    <SiteIcon name={SETUP_ICON[id]} size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[11.5px] font-extrabold uppercase sm:text-base">{t(`setups.${id}.name`)}</span>
                    <span className="block truncate text-[10px] text-white/60 sm:text-xs">
                      {n === undefined ? '…' : t(n === 1 ? 'setups.countOne' : 'setups.count', { count: n })}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* The chosen setup: its products, kind by kind, each in its own panel */}
        <div id="setup-panel" role="tabpanel" aria-labelledby="setups-heading" className="mt-3 grid gap-3 sm:mt-5 sm:gap-5 lg:grid-cols-2">
          {current.pending ? (
            <div className={cn(panel, 'lg:col-span-2')} role="status" aria-busy="true">
              <Skeleton className="mb-4 h-6 w-48 rounded-md" />
              <div className="flex gap-2.5 overflow-hidden sm:gap-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <Skeleton spinner key={i} className="aspect-[3/4.4] w-[calc((100%-0.625rem)/2)] shrink-0 rounded-2xl sm:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-3rem)/4)]" />
                ))}
              </div>
              <span className="sr-only">{t('ui.loadingProducts')}</span>
            </div>
          ) : !groups.length ? (
            <div className={cn(panel, 'text-center lg:col-span-2')}>
              <p className="py-4 text-sm text-[var(--fg-muted)]">{t('setups.empty')}</p>
              <Link to="/shop" className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--brand)] px-5 text-sm font-bold text-[var(--brand-fg)] transition hover:brightness-110">
                {t('setups.browseAll')}
                <SiteIcon name="arrow-right" size={16} className="rtl:rotate-180" />
              </Link>
            </div>
          ) : (
            groups.map((g) => {
              const slug = mainCategoryOf(g.items)
              const name = t(`setups.groups.${active}.${g.piece}`)
              // One or two products: half the width on computers, side by side with the next small group
              const small = g.items.length <= 2
              return (
                <section
                  key={`${active}-${g.piece}`}
                  id={pieceId(g.piece)}
                  aria-labelledby={`${pieceId(g.piece)}-title`}
                  className={cn(panel, 'min-w-0 scroll-mt-24', !small && 'lg:col-span-2')}
                >
                  <HomeSectionHead id={`${pieceId(g.piece)}-title`} title={name} viewAll={{ to: slug ? `/category/${slug}` : '/shop', label: t('setups.seeAll') }} />
                  {small ? (
                    <ul className="grid grid-cols-2 gap-2.5 sm:gap-4">
                      {g.items.map((p, i) => (
                        <li key={p._id} data-rise="card" style={{ animationDelay: `${i * 40}ms` }}>
                          <HomeShopCard product={p} eager={i < 2} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <HomeShelf products={g.items} label={name} />
                  )}
                </section>
              )
            })
          )}
        </div>

        {groups.length ? (
          <div className="mt-4 flex justify-center sm:mt-6">
            <Link
              to="/shop"
              className="btn-shine inline-flex h-11 items-center gap-2 rounded-full bg-[var(--brand)] px-6 text-sm font-bold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110"
            >
              {t('setups.moreCta')}
              <SiteIcon name="arrow-right" size={15} className="rtl:rotate-180" />
            </Link>
          </div>
        ) : null}
      </Container>

      {/* Not sure what to choose? WhatsApp with the question written in, and the shop phone */}
      <div className="mt-2 sm:mt-4">
        <HomeHelpBand />
      </div>
    </div>
  )
}
