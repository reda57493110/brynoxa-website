import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type Ref } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { productsApi } from '@/api/productsApi'
import { categoriesApi } from '@/api/categoriesApi'
import { SafeImage } from '@/components/ui/SafeImage'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { categoryDisplayName } from '@/i18n'
import { useT } from '@/hooks/useT'
import { useLocaleStore } from '@/store/localeStore'
import { categoryIcon } from '@/lib/categoryIcon'
import { formatCurrency } from '@/lib/format'
import { imageFit, sizedImageUrl } from '@/lib/image'
import { cn } from '@/lib/cn'
import type { Product } from '@/types'

const RECENT_KEY = 'brynoxa-recent-searches'
const MAX_RECENT = 5

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, MAX_RECENT) : []
  } catch {
    return []
  }
}

function saveRecent(q: string) {
  try {
    const next = [q, ...readRecent().filter((x) => x.toLowerCase() !== q.toLowerCase())].slice(0, MAX_RECENT)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    /* private mode */
  }
}

/** Waits until typing pauses, so the server is not asked on every key. */
function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return v
}

/** The typed words in bold inside a product name. */
function Highlight({ text, query }: { text: string; query: string }) {
  const words = query.trim().split(/\s+/).filter((w) => w.length >= 2)
  if (!words.length) return <>{text}</>
  const rx = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return (
    <>
      {text.split(rx).map((part, i) =>
        i % 2 ? (
          <mark key={i} className="rounded bg-transparent font-bold text-[var(--brand-text)]">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  )
}

type Option =
  | { kind: 'product'; product: Product }
  | { kind: 'category'; slug: string; label: string; icon: ReturnType<typeof categoryIcon> }
  | { kind: 'recent'; q: string }
  | { kind: 'all'; q: string }

/**
 * Search field with live results: products (photo, name, price) and matching categories appear
 * while typing; recent searches and the categories show when the field is empty. Arrow keys move,
 * Enter opens, Escape closes. Enter on the text searches the whole shop (/shop?q=…).
 */
export function SearchBox({
  inputRef,
  className,
  inputClassName,
  autoFocus,
  onDone,
  showShortcut,
}: {
  inputRef?: Ref<HTMLInputElement>
  className?: string
  inputClassName?: string
  autoFocus?: boolean
  /** Called after a choice (closes the phone search bar). */
  onDone?: () => void
  showShortcut?: boolean
}) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const navigate = useNavigate()
  const listId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [recent, setRecent] = useState<string[]>(() => readRecent())
  const query = q.trim()
  const debounced = useDebounced(query, 220)
  const searching = debounced.length >= 2

  const results = useQuery({
    queryKey: ['search-suggest', debounced],
    queryFn: async () => {
      const res = await productsApi.list({ q: debounced, limit: 6 })
      return { items: res.data.data, total: (res.data as { meta?: { total?: number } }).meta?.total ?? res.data.data.length }
    },
    enabled: open && searching,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await categoriesApi.list()).data.data,
    enabled: open,
    staleTime: 5 * 60_000,
  })

  const options: Option[] = useMemo(() => {
    const cats = (categories.data ?? []).map((c) => ({
      kind: 'category' as const,
      slug: c.slug,
      label: categoryDisplayName(locale, c.slug, c.name),
      icon: categoryIcon(c.slug, c.name),
    }))
    if (!searching) {
      return [...recent.map((r) => ({ kind: 'recent' as const, q: r })), ...cats.slice(0, 6)]
    }
    const lower = debounced.toLowerCase()
    const matchingCats = cats.filter((c) => c.label.toLowerCase().includes(lower) || c.slug.includes(lower)).slice(0, 3)
    return [
      ...matchingCats,
      ...(results.data?.items ?? []).map((product) => ({ kind: 'product' as const, product })),
      { kind: 'all' as const, q: debounced },
    ]
  }, [categories.data, debounced, locale, recent, results.data, searching])

  useEffect(() => setActive(-1), [debounced, open])

  // Close when clicking elsewhere
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const finish = () => {
    setOpen(false)
    setQ('')
    onDone?.()
  }

  const searchAll = (text: string) => {
    const s = text.trim()
    if (s) {
      saveRecent(s)
      setRecent(readRecent())
    }
    navigate(s ? `/shop?q=${encodeURIComponent(s)}` : '/shop')
    finish()
  }

  const choose = (o: Option) => {
    if (o.kind === 'product') {
      if (query) saveRecent(query)
      navigate(`/product/${o.product.slug}`)
      finish()
    } else if (o.kind === 'category') {
      navigate(`/shop?category=${encodeURIComponent(o.slug)}`)
      finish()
    } else {
      searchAll(o.q)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (active >= 0 && options[active]) choose(options[active])
    else searchAll(q)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (i + 1) % Math.max(options.length, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i <= 0 ? options.length - 1 : i - 1))
    } else if (e.key === 'Escape') {
      setOpen(false)
      ;(e.target as HTMLInputElement).blur()
    }
  }

  const clearRecent = () => {
    try {
      localStorage.removeItem(RECENT_KEY)
    } catch {
      /* ignore */
    }
    setRecent([])
  }

  const optionClass = (i: number) =>
    cn(
      'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start text-sm transition',
      i === active ? 'bg-[color-mix(in_srgb,var(--brand)_12%,transparent)]' : 'hover:bg-[var(--bg-muted)]'
    )

  let idx = -1
  const productOptions = options.filter((o) => o.kind === 'product')
  const showPanel = open && (options.length > 0 || searching)

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <form onSubmit={onSubmit} role="search">
        <label className="relative block">
          <span className="sr-only">{t('common.search')}</span>
          <SiteIcon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            autoFocus={autoFocus}
            placeholder={t('common.searchPlaceholder')}
            role="combobox"
            aria-expanded={showPanel}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            enterKeyHint="search"
            autoComplete="off"
            className={cn(
              'w-full rounded-full border border-[var(--border)] ps-9 text-[var(--fg)] placeholder:text-[var(--fg-muted)] outline-none ring-brand',
              inputClassName
            )}
          />
          {q ? (
            <button
              type="button"
              onClick={() => {
                setQ('')
                setOpen(true)
              }}
              className="absolute end-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
              aria-label={t('ui.clear')}
            >
              <SiteIcon name="close" size={13} />
            </button>
          ) : showShortcut ? (
            <kbd className="pointer-events-none absolute end-2.5 top-1/2 hidden -translate-y-1/2 rounded-md border border-[var(--border)] bg-[var(--bg-muted)] px-1.5 py-px text-[10px] font-medium text-[var(--fg-muted)] lg:inline">
              /
            </kbd>
          ) : null}
        </label>
      </form>

      {showPanel ? (
        <div
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(70vh,32rem)] min-w-[18rem] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-2 text-[var(--fg)] shadow-soft-lg"
        >
          {!searching ? (
            <>
              {recent.length ? (
                <div className="mb-1">
                  <div className="flex items-center justify-between px-2.5 pb-1 pt-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--fg-muted)]">{t('searchBox.recent')}</p>
                    <button type="button" onClick={clearRecent} className="text-[11px] font-medium text-[var(--fg-muted)] hover:text-[var(--brand-text)]">
                      {t('ui.clear')}
                    </button>
                  </div>
                  {options
                    .filter((o) => o.kind === 'recent')
                    .map((o) => {
                      idx++
                      const i = idx
                      return (
                        <button key={`r-${o.q}`} id={`${listId}-${i}`} role="option" aria-selected={i === active} type="button" onClick={() => choose(o)} className={optionClass(i)}>
                          <SiteIcon name="clock" size={15} className="shrink-0 text-[var(--fg-muted)]" />
                          <span className="truncate">{o.q}</span>
                        </button>
                      )
                    })}
                </div>
              ) : null}
              <p className="px-2.5 pb-1.5 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--fg-muted)]">{t('searchBox.browse')}</p>
              <div className="flex flex-wrap gap-1.5 px-1.5 pb-1.5">
                {options
                  .filter((o) => o.kind === 'category')
                  .map((o) => {
                    idx++
                    const i = idx
                    return (
                      <button
                        key={`c-${o.slug}`}
                        id={`${listId}-${i}`}
                        role="option"
                        aria-selected={i === active}
                        type="button"
                        onClick={() => choose(o)}
                        className={cn(
                          'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition',
                          i === active ? 'border-[var(--brand)] text-[var(--brand-text)]' : 'border-[var(--border)] hover:border-[var(--brand)]'
                        )}
                      >
                        <SiteIcon name={o.icon} size={13} className="text-[var(--brand-text)]" />
                        {o.label}
                      </button>
                    )
                  })}
              </div>
            </>
          ) : (
            <>
              {options
                .filter((o) => o.kind === 'category')
                .map((o) => {
                  idx++
                  const i = idx
                  return (
                    <button key={`c-${o.slug}`} id={`${listId}-${i}`} role="option" aria-selected={i === active} type="button" onClick={() => choose(o)} className={optionClass(i)}>
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] text-[var(--brand-text)]">
                        <SiteIcon name={o.icon} size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          <Highlight text={o.label} query={debounced} />
                        </span>
                        <span className="block text-xs text-[var(--fg-muted)]">{t('searchBox.category')}</span>
                      </span>
                      <SiteIcon name="arrow-right" size={14} className="shrink-0 text-[var(--fg-muted)] rtl:rotate-180" />
                    </button>
                  )
                })}

              {productOptions.length ? (
                <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--fg-muted)]">{t('searchBox.products')}</p>
              ) : null}
              {productOptions.map((o) => {
                idx++
                const i = idx
                const p = o.product
                const img = p.images?.find((x) => x.isPrimary)?.url || p.images?.[0]?.url
                const contain = imageFit(img) === 'contain'
                const off = p.compareAtPrice && p.compareAtPrice > p.price ? Math.round((1 - p.price / p.compareAtPrice) * 100) : null
                return (
                  <button key={p._id} id={`${listId}-${i}`} role="option" aria-selected={i === active} type="button" onClick={() => choose(o)} className={optionClass(i)}>
                    <span className={cn('relative size-12 shrink-0 overflow-hidden rounded-lg', contain ? 'photo-stage' : 'bg-[var(--bg-muted)]')}>
                      {img ? (
                        <SafeImage
                          src={sizedImageUrl(img, 160)}
                          alt=""
                          width={96}
                          height={96}
                          referrerPolicy="no-referrer"
                          className={cn('h-full w-full', contain ? 'object-contain p-1 mix-blend-multiply' : 'object-cover')}
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 font-medium">
                        <Highlight text={p.name} query={debounced} />
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs">
                        <span className="font-semibold text-[var(--fg)]">{formatCurrency(p.price)}</span>
                        {off ? <span className="rounded bg-[var(--brand)] px-1 text-[10px] font-bold text-[var(--brand-fg)]">-{off}%</span> : null}
                        {p.stock <= 0 ? <span className="text-[var(--danger)]">{t('product.outOfStock')}</span> : null}
                      </span>
                    </span>
                  </button>
                )
              })}

              {!results.isFetching && results.isSuccess && !productOptions.length ? (
                <div className="px-3 py-5 text-center">
                  <p className="text-sm font-medium">{t('searchBox.noResults', { q: debounced })}</p>
                  <p className="mt-1 text-xs text-[var(--fg-muted)]">{t('searchBox.noResultsHint')}</p>
                </div>
              ) : null}
              {results.isFetching && !productOptions.length ? (
                <p className="px-3 py-4 text-center text-sm text-[var(--fg-muted)]">{t('ui.loadingProducts')}</p>
              ) : null}

              {(() => {
                const allOpt = options.find((o) => o.kind === 'all')
                if (!allOpt) return null
                idx++
                const i = idx
                return (
                  <button
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    type="button"
                    onClick={() => choose(allOpt)}
                    className={cn(
                      'mt-1 flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition',
                      i === active ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-fg)]' : 'border-[var(--border)] text-[var(--brand-text)] hover:border-[var(--brand)]'
                    )}
                  >
                    {results.data?.total ? t('searchBox.seeAll', { count: results.data.total, q: debounced }) : t('searchBox.searchShop', { q: debounced })}
                    <SiteIcon name="arrow-right" size={14} className="rtl:rotate-180" />
                  </button>
                )
              })()}
            </>
          )}
        </div>
      ) : null}
    </div>
  )
}
