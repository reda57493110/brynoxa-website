import { useRef } from 'react'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useT } from '@/hooks/useT'
import { categoryIcon } from '@/lib/categoryIcon'
import { categoryThumb } from '@/lib/categoryPhoto'
import { cn } from '@/lib/cn'
import { categoryDisplayName } from '@/i18n'
import { useLocaleStore } from '@/store/localeStore'
import type { Category } from '@/types'

/**
 * A row of category cards under the banner (photo + name), like the shops' "PC portables
 * bureautique / gaming / pro" cards: the main categories on "All", the sub-categories inside a
 * category. Scrolls sideways; ‹ › on computers.
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
  /** The "All" card: its label and whether it is the chosen one */
  activeSlug?: string
  label: string
  onPick: (slug: string | undefined) => void
}) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const track = useRef<HTMLUListElement>(null)
  if (!items.length) return null
  const move = (dir: 1 | -1) => {
    const el = track.current
    if (!el) return
    const rtl = getComputedStyle(el).direction === 'rtl'
    el.scrollBy({ left: dir * (rtl ? -1 : 1) * el.clientWidth * 0.8, behavior: 'smooth' })
  }
  const card = (on: boolean) =>
    cn(
      'group flex h-full w-full items-center gap-2.5 rounded-2xl border p-2 text-start transition sm:gap-3 sm:p-2.5',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
      on
        ? 'border-[var(--brand)] bg-[rgb(0_194_255/0.1)] shadow-[inset_0_-3px_0_var(--brand)]'
        : 'border-[var(--border)] bg-[var(--bg-elevated)] hover:border-[rgb(0_194_255/0.6)]'
    )
  return (
    <div className="relative mt-3 sm:mt-4">
      <ul ref={track} aria-label={label} className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:gap-3 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <li className="w-[9.5rem] shrink-0 snap-start sm:w-[12rem]">
          <button type="button" onClick={() => onPick(undefined)} aria-pressed={!activeSlug} className={card(!activeSlug)}>
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[rgb(0_194_255/0.14)] text-[var(--brand-text)] sm:size-14">
              <SiteIcon name="layers" size={20} />
            </span>
            <span className="text-[12.5px] font-extrabold uppercase leading-tight sm:text-sm">{t('shop.all')}</span>
          </button>
        </li>
        {items.map((c) => {
          const on = activeSlug === c.slug
          const thumb = categoryThumb(c, all)
          return (
            <li key={c._id} className="w-[11rem] shrink-0 snap-start sm:w-[14rem]">
              <button type="button" onClick={() => onPick(c.slug)} aria-pressed={on} className={card(on)}>
                <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-[var(--bg-muted)] text-[var(--brand-text)] sm:size-14">
                  {thumb ? (
                    <img src={thumb} alt="" width={56} height={56} loading="lazy" decoding="async" className="h-full w-full object-cover transition duration-500 group-hover:scale-110" />
                  ) : (
                    <SiteIcon name={categoryIcon(c.slug, c.name)} size={20} />
                  )}
                </span>
                <span className="min-w-0 text-[12.5px] font-extrabold uppercase leading-tight sm:text-sm">
                  <span className="line-clamp-2">{categoryDisplayName(locale, c.slug, c.name)}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {items.length > 3 ? (
        <>
          <button type="button" onClick={() => move(-1)} aria-label={t('home.scrollPrev')} className="absolute -start-4 top-1/2 hidden size-9 -translate-y-1/2 place-items-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] shadow-soft hover:border-[var(--brand)] lg:grid">
            <SiteIcon name="chevron-left" size={16} className="rtl:rotate-180" />
          </button>
          <button type="button" onClick={() => move(1)} aria-label={t('home.scrollNext')} className="absolute -end-4 top-1/2 hidden size-9 -translate-y-1/2 place-items-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] shadow-soft hover:border-[var(--brand)] lg:grid">
            <SiteIcon name="chevron-right" size={16} className="rtl:rotate-180" />
          </button>
        </>
      ) : null}
    </div>
  )
}
