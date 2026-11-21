import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useT } from '@/hooks/useT'
import { cn } from '@/lib/cn'

/** Panels under the band: the same white (or dark) rounded box as the home page and the shop */
export const pagePanel = 'rounded-[1.25rem] border border-[var(--border)] bg-[var(--bg-elevated)] p-3 sm:rounded-[2rem] sm:p-6 lg:p-7'

/** The main button on a band */
export const bandPrimaryPill =
  'btn-shine inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-5 text-[13px] font-bold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 sm:h-12 sm:px-7 sm:text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]'

/** A second button on a band ("white" follows the band's text colour, see .ink in index.css) */
export const bandGhostPill =
  'inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-5 text-[13px] font-bold text-white transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] sm:h-12 sm:px-6 sm:text-base'

/** Path: Home › … › this page (the last one is the current page) */
export function PageCrumbs({ items }: { items: { label: string; to?: string }[] }) {
  const t = useT()
  return (
    <nav aria-label={t('shop.breadcrumb')} className="mb-2.5 sm:mb-3">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-[var(--fg-muted)] sm:text-[13px]">
        <li>
          <Link to="/" className="hover:text-[var(--brand-text)]">
            {t('common.home')}
          </Link>
        </li>
        {items.map((it, i) => (
          <li key={it.label} className="inline-flex min-w-0 items-center gap-1">
            <SiteIcon name="chevron-right" size={12} className="opacity-60 rtl:rotate-180" />
            {it.to && i < items.length - 1 ? (
              <Link to={it.to} className="hover:text-[var(--brand-text)]">
                {it.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate font-semibold uppercase text-[var(--fg)]">
                {it.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/**
 * The top of the shop's information pages (Services, Contact, Track order, Help), in the home /
 * shop / setups look: the path, then the Brynoxa band (dark; white in light mode). With `image`,
 * the page's photo fills the top of the band and the title sits on it (a shade keeps it readable
 * in both modes). `children`: buttons or a form under the text; `below`: big buttons or tiles
 * under the photo, inside the band.
 */
export function PageBand({
  crumbs,
  titleId,
  kicker,
  title,
  accent,
  body,
  image,
  imagePosition = 'object-center',
  children,
  below,
}: {
  crumbs: { label: string; to?: string }[]
  titleId: string
  kicker?: ReactNode
  title: ReactNode
  accent?: ReactNode
  body?: ReactNode
  image?: string
  imagePosition?: string
  children?: ReactNode
  below?: ReactNode
}) {
  const text = (
    <>
      {kicker ? <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--brand)] sm:text-xs">{kicker}</p> : null}
      <h1 id={titleId} className="text-white mt-1 max-w-3xl font-display text-xl font-black uppercase leading-[1.05] tracking-tight sm:mt-2 sm:text-4xl lg:text-5xl">
        {title}
        {accent ? <span className="text-[var(--brand)]"> {accent}</span> : null}
      </h1>
      {body ? <p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-white/75 sm:mt-3 sm:text-base">{body}</p> : null}
      {children ? <div className="mt-3 sm:mt-6">{children}</div> : null}
    </>
  )
  return (
    <Container>
      <PageCrumbs items={crumbs} />
      <section
        aria-labelledby={titleId}
        className={cn(
          'ink relative isolate overflow-hidden rounded-[1.25rem] border border-[rgb(0_194_255/0.3)] bg-[#05080b] text-white sm:rounded-[2rem]',
          image ? 'p-1.5 sm:p-2.5' : 'p-3.5 sm:p-8 lg:p-10'
        )}
      >
        <span className="ink-glow absolute inset-0 -z-10 bg-[radial-gradient(60%_90%_at_100%_0%,rgb(0_194_255/0.25),transparent_60%),radial-gradient(50%_80%_at_0%_100%,rgb(0_194_255/0.12),transparent_60%)]" aria-hidden="true" />
        {image ? (
          <>
            {/* Phones: the photo as a strip above the text; larger screens: the text on the photo */}
            <div className="relative isolate flex flex-col justify-center overflow-hidden rounded-[1rem] sm:min-h-[20rem] sm:rounded-[1.6rem] sm:p-8 lg:p-10">
              <span className="relative block aspect-[16/7] overflow-hidden rounded-[0.85rem] sm:absolute sm:inset-0 sm:-z-20 sm:aspect-auto sm:rounded-none">
                <img
                  src={image}
                  srcSet={/[?&]w=\d+/.test(image) ? [800, 1400, 2560].map((w) => `${image.replace(/([?&])w=\d+/, `$1w=${w}`)} ${w}w`).join(', ') : undefined}
                  sizes="(min-width: 1280px) 1200px, 100vw"
                  alt=""
                  width={1600}
                  height={900}
                  decoding="async"
                  fetchPriority="high"
                  className={cn('absolute inset-0 h-full w-full object-cover', imagePosition)} />
              </span>
              <span
                className="ink-shade-x absolute inset-0 -z-10 hidden sm:block bg-[linear-gradient(90deg,#05080b_0%,rgb(5_8_11/0.88)_40%,rgb(5_8_11/0.3)_80%,rgb(5_8_11/0.1)_100%)] rtl:bg-[linear-gradient(270deg,#05080b_0%,rgb(5_8_11/0.88)_40%,rgb(5_8_11/0.3)_80%,rgb(5_8_11/0.1)_100%)]"
                aria-hidden="true"
              />
              <div className="px-2 pb-1 pt-3 sm:p-0">{text}</div>
            </div>
            {below ? <div className="p-2 pt-2.5 sm:p-5 sm:pt-5 lg:p-7 lg:pt-6">{below}</div> : null}
          </>
        ) : (
          <>
            {text}
            {below ? <div className="mt-3 sm:mt-7">{below}</div> : null}
          </>
        )}
      </section>
    </Container>
  )
}
