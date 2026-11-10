import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQueries } from '@tanstack/react-query'
import { Container } from '@/components/ui/Container'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { ProductCard } from '@/components/product/ProductCard'
import { ProductCarousel } from '@/components/product/ProductCarousel'
import { productsApi } from '@/api/productsApi'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useT } from '@/hooks/useT'
import { useSeo } from '@/hooks/useSeo'
import { useLocaleStore } from '@/store/localeStore'
import { cn } from '@/lib/cn'
import { SETUP_ICON, SETUP_IDS, SETUP_PIECES, isSetupId, setupPieceOf, type SetupId, type SetupPiece } from '@/lib/setups'
import type { Product } from '@/types'

/** Products asked for per setup (the server's page size limit) */
const SETUP_LIMIT = 100

/**
 * "Pick your setup" (/setups, /setups/gaming …): the customer picks what the computer is for
 * (gaming, study, work, streaming & creation) and sees only what goes with it, grouped by part
 * (computer, screen, mouse / keyboard / headset, components, cameras, accessories). In stock only.
 * Which products: lib/setups.ts (ticked in admin, or by category).
 */
export function Setups() {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const navigate = useNavigate()
  const { kind } = useParams()
  const isPhone = !useMediaQuery('(min-width: 640px)')
  const active: SetupId = isSetupId(kind) ? kind : 'gaming'
  const amount = (n: number) => new Intl.NumberFormat(locale === 'ar' ? 'ar-MA' : locale === 'fr' ? 'fr-MA' : 'en-US').format(n)

  // Every setup at once: the tiles show how many products each has
  const lists = useQueries({
    queries: SETUP_IDS.map((id) => ({
      queryKey: ['products', 'setup', id],
      queryFn: async () => (await productsApi.list({ setup: id, inStock: true, sort: 'popular', limit: SETUP_LIMIT })).data.data,
      staleTime: 60_000,
    })),
  })
  const byId = Object.fromEntries(SETUP_IDS.map((id, i) => [id, lists[i]])) as Record<SetupId, (typeof lists)[number]>
  const current = byId[active]
  const products: Product[] = current.data ?? []
  const groups = SETUP_PIECES[active]
    .map((piece) => ({ piece, items: products.filter((p) => setupPieceOf(typeof p.category === 'object' ? p.category?.slug : undefined) === piece) }))
    .filter((g) => g.items.length)

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
          <h1 id="setups-heading" className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-5xl">
            {t('setups.title')}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--fg-muted)] sm:text-base">{t('setups.body')}</p>
        </div>

        {/* The setups: tap one to see what goes with it */}
        <div role="tablist" aria-label={t('setups.kicker')} className="mt-6 grid grid-cols-2 gap-2.5 sm:mt-8 sm:gap-3 lg:grid-cols-4">
          {SETUP_IDS.map((id) => {
            const on = id === active
            const n = byId[id].data?.length
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="setup-panel"
                onClick={() => pick(id)}
                className={cn(
                  'group relative flex min-w-0 flex-col items-start gap-2.5 overflow-hidden rounded-2xl border p-3 text-start transition sm:gap-3 sm:p-5',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
                  on
                    ? 'border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_12%,var(--bg))] shadow-glow'
                    : 'border-[var(--border)] bg-[var(--bg-elevated)] hover:-translate-y-0.5 hover:border-[var(--brand)]'
                )}
              >
                <span
                  className={cn(
                    'grid size-10 place-items-center rounded-xl transition sm:size-12',
                    on ? 'bg-[var(--brand)] text-[var(--brand-fg)]' : 'bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] text-[var(--brand-text)]'
                  )}
                >
                  <SiteIcon name={SETUP_ICON[id]} size={20} />
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-base font-semibold leading-tight sm:text-xl">{t(`setups.${id}.name`)}</span>
                  <span className="mt-1 block text-xs leading-snug text-[var(--fg-muted)] sm:text-sm">{t(`setups.${id}.tagline`)}</span>
                  <span className="mt-2 block text-[11px] font-semibold text-[var(--brand-text)] sm:text-xs">
                    {n === undefined ? '…' : t('setups.count', { count: n })}
                  </span>
                </span>
                {on ? <SiteIcon name="check" size={16} className="absolute end-3 top-3 text-[var(--brand-text)]" /> : null}
              </button>
            )
          })}
        </div>

        {/* The chosen setup */}
        <div id="setup-panel" role="tabpanel" className="mt-6 rounded-[1.5rem] border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-soft sm:mt-8 sm:rounded-[2rem] sm:p-7">
          <div className="flex flex-wrap items-start gap-3 sm:gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] shadow-glow sm:size-14">
              <SiteIcon name={SETUP_ICON[active]} size={24} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{t(`setups.${active}.name`)}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--fg-muted)] sm:text-base">{t(`setups.${active}.intro`)}</p>
            </div>
          </div>

          {groups.length ? (
            <nav aria-label={t('setups.inside')} className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">{t('setups.inside')}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {groups.map((g) => (
                  <li key={g.piece}>
                    <a
                      href={`#${pieceId(g.piece)}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3.5 text-xs font-semibold transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] sm:text-sm"
                    >
                      {t(`setups.piece.${g.piece}`)}
                      <span className="rounded-full bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] px-1.5 text-[11px] text-[var(--brand-text)]">{g.items.length}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          {current.isPending ? (
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
            <div className="mt-2">
              {groups.map((g) => (
                <div key={`${active}-${g.piece}`} id={pieceId(g.piece)} className="scroll-mt-24 border-t border-[var(--border)] pt-5 mt-5 first:mt-4">
                  <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-display text-lg font-semibold sm:text-xl">{t(`setups.piece.${g.piece}`)}</h3>
                    <p className="text-xs text-[var(--fg-muted)] sm:text-sm">
                      {t('setups.count', { count: g.items.length })} · {t('setups.from', { price: amount(Math.min(...g.items.map((p) => p.price))) })}
                    </p>
                  </div>
                  {isPhone && g.items.length > 1 ? (
                    <ProductCarousel products={g.items} size="lg" />
                  ) : (
                    <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {g.items.map((p, i) => (
                        <div key={p._id} className="h-full" data-rise="card" style={{ animationDelay: `${Math.min(i, 7) * 40}ms` }}>
                          <ProductCard product={p} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Not sure? */}
        <div className="mt-6 flex flex-col items-start gap-4 rounded-[1.5rem] border border-[color-mix(in_srgb,var(--brand)_35%,var(--border))] bg-[radial-gradient(80%_120%_at_0%_0%,color-mix(in_srgb,var(--brand)_14%,transparent),transparent_60%)] bg-[var(--bg-elevated)] p-5 sm:mt-8 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="max-w-xl">
            <h2 className="font-display text-xl font-semibold sm:text-2xl">{t('setups.helpTitle')}</h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--fg-muted)]">{t('setups.helpBody')}</p>
          </div>
          <Link to="/contact" className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-[var(--brand)] px-5 text-sm font-semibold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110">
            <SiteIcon name="chat" size={16} />
            {t('setups.helpCta')}
          </Link>
        </div>
      </Container>
    </section>
  )
}
