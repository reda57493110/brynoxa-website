import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useT } from '@/hooks/useT'
import { categoryIcon } from '@/lib/categoryIcon'
import { childrenOf, mainCategories } from '@/lib/categoryTree'
import { cn } from '@/lib/cn'
import { categoryDisplayName } from '@/i18n'
import { useLocaleStore } from '@/store/localeStore'
import type { Brand, Category } from '@/types'
import { sizedImageUrl } from '@/lib/image'

export interface ShopFilterValues {
  category?: string
  brand?: string
  minPrice?: string
  maxPrice?: string
  inStock?: boolean
  onSale?: boolean
}

export const PRICE_PRESETS: Array<{ min?: string; max?: string }> = [
  { max: '1000' },
  { min: '1000', max: '5000' },
  { min: '5000', max: '15000' },
  { min: '15000' },
]

/** Brands shown before "Show more" */
const BRANDS_SHOWN = 6

const ALL_CAPS = new Set(['hp', 'msi', 'lg', 'ibm', 'amd', 'cpu', 'gpu', 'ssd', 'hdd', 'usb'])
function displayBrand(name: string) {
  const s = name.trim()
  if (ALL_CAPS.has(s.toLowerCase())) return s.toUpperCase()
  return s
    .split(/[\s_-]+/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ')
}

/** A folding section with its title in capitals (open by default) */
function Section({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border-t border-[var(--border)] py-3.5 first:border-t-0 first:pt-0">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 text-start">
        <h3 className="text-[13px] font-extrabold uppercase tracking-wide text-[var(--fg)]">{title}</h3>
        <SiteIcon name="chevron-down" size={15} className={cn('text-[var(--fg-muted)] transition', open && 'rotate-180')} />
      </button>
      {open ? <div className="mt-2.5">{children}</div> : null}
    </section>
  )
}

/** A line with a round (single choice) or square (on / off) box, like the shops' filter lists */
function Choice({ on, label, onClick, round = false, icon }: { on: boolean; label: ReactNode; onClick: () => void; round?: boolean; icon?: ReactNode }) {
  return (
    <button
      type="button"
      role={round ? 'radio' : 'checkbox'}
      aria-checked={on}
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-start text-[13px] transition hover:bg-[var(--bg-muted)]',
        on ? 'font-semibold text-[var(--fg)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
      )}
    >
      <span
        className={cn(
          'grid size-[18px] shrink-0 place-items-center border transition',
          round ? 'rounded-full' : 'rounded-[5px]',
          on ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-fg)]' : 'border-[var(--border)] group-hover:border-[var(--brand)]'
        )}
      >
        {on ? round ? <span className="size-1.5 rounded-full bg-[var(--brand-fg)]" /> : <SiteIcon name="check" size={12} /> : null}
      </span>
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  )
}

/**
 * Shop filters, in the shops' style: a Reset button, then folding sections — Categories (with
 * their sub-categories), Price (four ranges or your own min / max), Availability (in stock, deals)
 * and Brand (show more). Every choice is in the address, so the page can be shared or reloaded.
 */
export function ShopFilters({
  categories,
  soon = [],
  brands,
  values,
  onChange,
  onClear,
  activeCount,
}: {
  categories: Category[]
  /** Empty sub-categories: listed greyed with "Coming soon" */
  soon?: Category[]
  brands: Brand[]
  values: ShopFilterValues
  onChange: (next: ShopFilterValues) => void
  onClear: () => void
  activeCount: number
}) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const [moreBrands, setMoreBrands] = useState(false)
  const [min, setMin] = useState(values.minPrice ?? '')
  const [max, setMax] = useState(values.maxPrice ?? '')
  useEffect(() => {
    setMin(values.minPrice ?? '')
    setMax(values.maxPrice ?? '')
  }, [values.minPrice, values.maxPrice])

  const amount = (n: string) => Number(n).toLocaleString('fr-MA')
  const presetOn = (p: { min?: string; max?: string }) => (p.min || '') === (values.minPrice || '') && (p.max || '') === (values.maxPrice || '')
  const applyRange = (e: FormEvent) => {
    e.preventDefault()
    const clean = (s: string) => (/^\d+$/.test(s.replace(/\s/g, '')) ? String(Number(s.replace(/\s/g, ''))) : undefined)
    let lo = clean(min)
    let hi = clean(max)
    if (lo && hi && Number(lo) > Number(hi)) [lo, hi] = [hi, lo]
    onChange({ ...values, minPrice: lo, maxPrice: hi })
  }
  const shownBrands = moreBrands ? brands : brands.slice(0, BRANDS_SHOWN)

  return (
    <div>
      <button
        type="button"
        onClick={onClear}
        disabled={!activeCount}
        className="mb-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--brand)] text-sm font-bold text-[var(--brand-text)] transition hover:bg-[rgb(0_194_255/0.1)] disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:text-[var(--fg-muted)] disabled:hover:bg-transparent"
      >
        <SiteIcon name="refresh" size={15} />
        {t('shop.resetFilters')}
        {activeCount ? <span className="rounded-full bg-[var(--brand)] px-1.5 text-[11px] leading-5 text-[var(--brand-fg)]">{activeCount}</span> : null}
      </button>

      <Section title={t('shop.category')}>
        <div role="radiogroup" aria-label={t('shop.category')} className="space-y-0.5">
          <Choice round on={!values.category} label={t('shop.allCategories')} onClick={() => onChange({ ...values, category: undefined })} />
          {mainCategories(categories).map((c) => {
            const subs = childrenOf(categories, c._id)
            const later = childrenOf(soon, c._id)
            return (
              <div key={c._id}>
                <Choice
                  round
                  on={values.category === c.slug}
                  icon={<SiteIcon name={categoryIcon(c.slug, c.name)} size={14} className="shrink-0 text-[var(--brand-text)]" />}
                  label={categoryDisplayName(locale, c.slug, c.name)}
                  onClick={() => onChange({ ...values, category: c.slug })}
                />
                {subs.length || later.length ? (
                  <div className="ms-3 border-s-2 border-[rgb(0_194_255/0.3)] ps-2">
                    {subs.map((s) => (
                      <Choice key={s._id} round on={values.category === s.slug} label={categoryDisplayName(locale, s.slug, s.name)} onClick={() => onChange({ ...values, category: s.slug })} />
                    ))}
                    {later.map((s) => (
                      <p key={s._id} className="flex items-center justify-between gap-2 px-1.5 py-1 text-[12px] text-[var(--fg-muted)] opacity-70">
                        <span className="truncate">{categoryDisplayName(locale, s.slug, s.name)}</span>
                        <span className="shrink-0 text-[10px] font-bold text-[var(--brand-text)]">{t('shop.comingSoon')}</span>
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </Section>

      <Section title={t('shop.priceDh')}>
        <div role="radiogroup" aria-label={t('shop.priceDh')} className="space-y-0.5">
          {PRICE_PRESETS.map((p) => {
            const on = presetOn(p)
            const label = p.max && !p.min ? t('shop.under', { amount: amount(p.max) }) : p.min && !p.max ? `${amount(p.min)}+ DH` : `${amount(p.min!)} – ${amount(p.max!)} DH`
            return (
              <Choice
                key={`${p.min || ''}-${p.max || ''}`}
                round
                on={on}
                label={label}
                onClick={() => onChange({ ...values, minPrice: on ? undefined : p.min, maxPrice: on ? undefined : p.max })}
              />
            )
          })}
        </div>
        <form onSubmit={applyRange} className="mt-2.5 flex items-end gap-1.5">
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-[11px] font-semibold text-[var(--fg-muted)]">{t('shop.min')}</span>
            <input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} placeholder="0" className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 text-sm outline-none focus:border-[var(--brand)]" />
          </label>
          <span className="pb-2 text-[var(--fg-muted)]">–</span>
          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-[11px] font-semibold text-[var(--fg-muted)]">{t('shop.max')}</span>
            <input inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} placeholder="∞" className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 text-sm outline-none focus:border-[var(--brand)]" />
          </label>
          <button type="submit" className="h-9 shrink-0 rounded-lg bg-[var(--brand)] px-3 text-xs font-bold text-[var(--brand-fg)] hover:brightness-110">
            {t('shop.apply')}
          </button>
        </form>
      </Section>

      <Section title={t('shop.availability')}>
        <Choice on={Boolean(values.inStock)} label={t('shop.inStockOnly')} onClick={() => onChange({ ...values, inStock: !values.inStock })} />
        <Choice on={Boolean(values.onSale)} label={t('shop.onSaleOnly')} onClick={() => onChange({ ...values, onSale: !values.onSale })} />
      </Section>

      {brands.length ? (
        <Section title={t('shop.brand')}>
          <div role="radiogroup" aria-label={t('shop.brand')} className="space-y-0.5">
            <Choice round on={!values.brand} label={t('shop.all')} onClick={() => onChange({ ...values, brand: undefined })} />
            {shownBrands.map((b) => (
              <Choice
                key={b._id}
                round
                on={values.brand === b.slug}
                icon={
                  b.logo ? (
                    <span className="grid h-6 w-10 shrink-0 place-items-center rounded bg-white px-1">
                      <img src={sizedImageUrl(b.logo, 80)} alt="" width={36} height={20} loading="lazy" className="max-h-4 w-auto max-w-full object-contain" />
                    </span>
                  ) : null
                }
                label={displayBrand(b.name)}
                onClick={() => onChange({ ...values, brand: values.brand === b.slug ? undefined : b.slug })}
              />
            ))}
          </div>
          {brands.length > BRANDS_SHOWN ? (
            <button type="button" onClick={() => setMoreBrands((m) => !m)} className="mt-1.5 text-xs font-bold text-[var(--brand-text)] hover:underline">
              {moreBrands ? t('shop.showLess') : t('shop.showMore', { count: brands.length - BRANDS_SHOWN })}
            </button>
          ) : null}
        </Section>
      ) : null}
    </div>
  )
}
