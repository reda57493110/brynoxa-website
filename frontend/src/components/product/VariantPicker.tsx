import { Link } from 'react-router-dom'
import { useT } from '@/hooks/useT'
import { useLocaleStore } from '@/store/localeStore'
import { variantAxes } from '@/lib/variants'
import { cn } from '@/lib/cn'
import type { Product } from '@/types'

/** Option buttons (RAM, storage…) switching between the variants of a product. */
export function VariantPicker({ product, template }: { product: Product; template: string }) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const axes = variantAxes(product._id, product.variants ?? [], template, product.variantAttributes, locale)
  if (!axes.length) return null

  return (
    <div className="mt-4 space-y-3">
      {axes.map((axis) => {
        const selected = axis.options.find((o) => o.selected)
        return (
          <div key={axis.key}>
            <p className="text-xs text-[var(--fg-muted)]">
              {axis.label}
              {selected ? <span className="ms-1 font-semibold text-[var(--fg)]">{selected.label}</span> : null}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2" role="list">
              {axis.options.map((o) => (
                <Link
                  key={o.value}
                  role="listitem"
                  to={`/product/${o.target.slug}`}
                  replace
                  preventScrollReset
                  aria-current={o.selected ? 'true' : undefined}
                  className={cn(
                    'inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 text-sm transition',
                    o.selected
                      ? 'border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] font-semibold text-[var(--fg)]'
                      : 'border-[var(--border)] hover:border-[var(--brand)]',
                    !o.available && 'text-[var(--fg-muted)]'
                  )}
                >
                  <span className={cn(!o.available && 'line-through decoration-1')}>{o.label}</span>
                  {!o.available ? <span className="text-[10px] no-underline">({t('productPage.unavailable')})</span> : null}
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
