import { SiteIcon } from '@/components/ui/SiteIcon'
import { useT } from '@/hooks/useT'
import { categoryIcon } from '@/lib/categoryIcon'
import { categoryThumb } from '@/lib/categoryPhoto'
import { cn } from '@/lib/cn'
import { categoryDisplayName } from '@/i18n'
import { useLocaleStore } from '@/store/localeStore'
import type { Category } from '@/types'

/**
 * The categories under the search bar as round photos with the name under them — the same look as
 * the home page ("Your dream setup" section). The main categories (and their sub-categories) on
 * "All", the sub-categories inside a category; empty ones say "Coming soon" and do not open.
 * One row you swipe on phones; it wraps on computers.
 */
export function ShopCategoryStrip({
  items,
  all,
  activeSlug,
  label,
  onPick,
}: {
  items: Category[]
  all: Category[]
  /** The chosen one (none = "All") */
  activeSlug?: string
  label: string
  onPick: (slug: string | undefined) => void
}) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  if (!items.length) return null

  const circle = (on: boolean, empty?: boolean) =>
    cn(
      'relative grid size-16 place-items-center overflow-hidden rounded-full border-2 bg-[var(--bg-muted)] text-[var(--brand-text)] shadow-soft transition duration-300 sm:size-20',
      on
        ? 'border-[var(--brand)] shadow-[0_0_0_4px_rgb(0_194_255/0.22)]'
        : empty
          ? 'border-[var(--border)]'
          : 'border-[var(--border)] group-hover:border-[var(--brand)] group-hover:shadow-[0_0_0_4px_rgb(0_194_255/0.18)]'
    )
  const name = (on: boolean) =>
    cn('line-clamp-2 text-center text-[10.5px] font-bold leading-tight sm:text-[13px]', on ? 'text-[var(--brand-text)]' : 'text-[var(--fg)] group-hover:text-[var(--brand-text)]')

  return (
    <ul
      aria-label={label}
      className="-mx-4 mt-3.5 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:mt-5 sm:flex-wrap sm:gap-5 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      <li className="w-16 shrink-0 snap-start sm:w-24">
        <button type="button" onClick={() => onPick(undefined)} aria-pressed={!activeSlug} className="group flex w-full flex-col items-center gap-1.5 focus-visible:outline-none">
          <span className={cn(circle(!activeSlug), 'bg-[rgb(0_194_255/0.12)]')}>
            <SiteIcon name="layers" size={24} />
          </span>
          <span className={name(!activeSlug)}>{t('shop.all')}</span>
        </button>
      </li>
      {items.map((c) => {
        const on = activeSlug === c.slug
        const thumb = categoryThumb(c, [...all, ...items])
        return (
          <li key={c._id} className="w-16 shrink-0 snap-start sm:w-24">
            <button
              type="button"
              // Nothing to buy yet: shown, but not a page to open
              disabled={c.empty}
              onClick={() => onPick(c.slug)}
              aria-pressed={on}
              className={cn('group flex w-full flex-col items-center gap-1.5 focus-visible:outline-none', c.empty && 'cursor-default opacity-50')}
            >
              <span className={circle(on, c.empty)}>
                {/* The icon shows until the photo arrives (and stays if there is none) */}
                <SiteIcon name={categoryIcon(c.slug, c.name)} size={22} />
                {thumb ? (
                  <img
                    src={thumb}
                    alt=""
                    width={80}
                    height={80}
                    // At the top of the page: loaded at once, not after the product photos
                    loading="eager"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-110"
                  />
                ) : null}
                <span className="absolute bottom-0.5 end-0.5 grid size-5 place-items-center rounded-full bg-[rgb(5_8_11/0.75)] text-[var(--brand)] sm:bottom-1 sm:end-1 sm:size-6">
                  <SiteIcon name={categoryIcon(c.slug, c.name)} size={12} />
                </span>
              </span>
              <span className={name(on)}>{categoryDisplayName(locale, c.slug, c.name)}</span>
              {c.empty ? <span className="-mt-1 text-[9px] font-bold text-[var(--brand-text)] sm:text-[10px]">{t('shop.comingSoon')}</span> : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
