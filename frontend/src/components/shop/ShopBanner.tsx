import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useT } from '@/hooks/useT'

/**
 * Top of the shop: the path (Home › Shop › Laptops) and the search bar — nothing else, so the
 * categories and the products come first. The page title is kept for Google and screen readers
 * (hidden on screen: the path and the chosen category already say where you are).
 */
export function ShopBanner({
  crumbs,
  title,
  search,
  onSearch,
}: {
  crumbs: { label: string; to?: string }[]
  title: string
  search: string
  onSearch: (q: string) => void
}) {
  const t = useT()
  const [draft, setDraft] = useState(search)
  useEffect(() => setDraft(search), [search])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSearch(draft.trim())
  }

  return (
    <div className="pt-2 sm:pt-4">
      <nav aria-label={t('shop.breadcrumb')} className="mb-2.5 sm:mb-3">
        <ol className="flex flex-wrap items-center gap-1 text-xs text-[var(--fg-muted)] sm:text-[13px]">
          {crumbs.map((c, i) => (
            <li key={i} className="inline-flex items-center gap-1">
              {i > 0 ? <SiteIcon name="chevron-right" size={12} className="opacity-60 rtl:rotate-180" /> : null}
              {c.to ? (
                <Link to={c.to} className="hover:text-[var(--brand-text)]">
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page" className="font-semibold uppercase text-[var(--fg)]">
                  {c.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <h1 id="shop-heading" className="sr-only">
        {title}
      </h1>

      <form
        onSubmit={submit}
        role="search"
        className="flex overflow-hidden rounded-2xl border border-[rgb(0_194_255/0.35)] bg-[var(--bg-elevated)] shadow-[0_12px_40px_-24px_rgb(0_194_255/0.6)] focus-within:border-[var(--brand)]"
      >
        <label htmlFor="shop-search" className="sr-only">
          {t('shop.searchShop')}
        </label>
        <span className="grid w-10 shrink-0 place-items-center text-[var(--fg-muted)] sm:w-12" aria-hidden="true">
          <SiteIcon name="search" size={18} />
        </span>
        <input
          id="shop-search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('shop.searchShopPlaceholder')}
          className="h-11 min-w-0 flex-1 bg-transparent pe-3 text-[13px] text-[var(--fg)] outline-none placeholder:text-[var(--fg-muted)] sm:h-13 sm:text-[15px]"
        />
        <button type="submit" className="shrink-0 bg-[var(--brand)] px-4 text-[13px] font-bold text-[var(--brand-fg)] transition hover:brightness-110 sm:px-7 sm:text-sm">
          {t('shop.searchAction')}
        </button>
      </form>
    </div>
  )
}
