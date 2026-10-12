import { SafeImage } from '@/components/ui/SafeImage'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { Spinner } from '@/components/ui/Spinner'
import type { ManagedSection } from '@/components/admin/SectionManager'
import { useStorefrontPlacements } from '@/hooks/useStorefrontPlacements'
import { formatCurrency } from '@/lib/format'
import { imageFit, sizedImageUrl } from '@/lib/image'
import { cn } from '@/lib/cn'
import type { Product } from '@/types'

function Tile({ product, index, onOpen }: { product: Product; index?: number; onOpen: (p: Product) => void }) {
  const image = product.images?.find((i) => i.isPrimary)?.url || product.images?.[0]?.url
  return (
    <button
      type="button"
      onClick={() => onOpen(product)}
      title={product.name}
      className="group flex w-[7.5rem] shrink-0 flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)] text-start transition hover:border-[var(--brand)]"
    >
      <span className={cn('relative block h-16 w-full overflow-hidden', imageFit(image) === 'contain' ? 'bg-white' : 'bg-[var(--bg-muted)]')}>
        {image ? (
          <SafeImage
            src={sizedImageUrl(image, 240)}
            alt=""
            referrerPolicy="no-referrer"
            className={cn('h-full w-full', imageFit(image) === 'contain' ? 'object-contain p-1 mix-blend-multiply' : 'object-cover')}
          />
        ) : null}
        {index !== undefined ? (
          <span className="absolute start-1 top-1 rounded bg-[var(--brand)] px-1 text-[10px] font-bold leading-4 text-[var(--brand-fg)]">#{index + 1}</span>
        ) : null}
      </span>
      <span className="block px-1.5 py-1">
        <span className="block truncate text-[11px] font-medium group-hover:text-[var(--brand-text)]">{product.name}</span>
        <span className="block text-[10px] tabular-nums text-[var(--fg-muted)]">{formatCurrency(product.price)}</span>
      </span>
    </button>
  )
}

function Section({
  icon,
  title,
  note,
  products,
  numbered = true,
  onManage,
  onOpen,
  empty,
}: {
  icon: SiteIconName
  title: string
  note?: string
  products: Product[]
  numbered?: boolean
  onManage?: () => void
  onOpen: (p: Product) => void
  empty: string
}) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-1.5">
        <SiteIcon name={icon} size={13} className="shrink-0 text-[var(--brand-text)]" />
        <p className="truncate text-xs font-semibold">{title}</p>
        <span className="rounded-full bg-[var(--bg-muted)] px-1.5 text-[10px] font-semibold tabular-nums text-[var(--fg-muted)]">{products.length}</span>
        {note ? <span className="truncate text-[11px] text-[var(--fg-muted)]">{note}</span> : null}
        {onManage ? (
          <button
            type="button"
            onClick={onManage}
            className="ms-auto inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-[var(--border)] px-2 text-[11px] font-medium text-[var(--brand-text)] hover:border-[var(--brand)]"
          >
            <SiteIcon name="sliders" size={11} /> Manage
          </button>
        ) : null}
      </div>
      {products.length ? (
        <div className="-mx-1 mt-1.5 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
          {products.map((p, i) => (
            <Tile key={p._id} product={p} index={numbered ? i : undefined} onOpen={onOpen} />
          ))}
        </div>
      ) : (
        <p className="mt-1.5 text-[11px] text-[var(--fg-muted)]">{empty}</p>
      )}
    </div>
  )
}

/**
 * The home page exactly as customers see it, section by section, top to bottom: Hero (top deals),
 * Featured (one big product), Carousel (the product row), plus the Shop page header. Every product
 * of a section is listed, in order, even when it is also in another section.
 */
export function HomeLayoutBoard({ onManage, onOpen }: { onManage: (s: ManagedSection) => void; onOpen: (p: Product) => void }) {
  const place = useStorefrontPlacements()

  if (!place.ready) {
    return (
      <div className="flex justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] py-6">
        <Spinner />
      </div>
    )
  }

  const featured = place.featuredList[0] ? [place.featuredList[0]] : []

  return (
    <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Home page</h2>
        <a href="/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[var(--brand-text)] hover:underline">
          View <SiteIcon name="external" size={11} />
        </a>
      </div>
      <Section
        icon="tag"
        title="1 · Hero (top deals)"
        note={place.pinnedDeals.length ? undefined : '· automatic: featured products in stock, biggest discount first'}
        products={place.deals.products}
        onManage={() => onManage('deals')}
        onOpen={onOpen}
        empty="No deals."
      />
      <Section
        icon="star"
        title="2 · Featured"
        note="· the big product card"
        products={featured}
        numbered={false}
        onManage={() => onManage('featured')}
        onOpen={onOpen}
        empty="No featured product."
      />
      <Section
        icon="layers"
        title="3 · Carousel"
        note={place.rowFromCarousel ? '· the product row under Featured' : '· empty, so it shows your next featured products'}
        products={place.row}
        onManage={() => onManage('row')}
        onOpen={onOpen}
        empty="No products in the carousel."
      />
      <div className="border-t border-[var(--border)] pt-3">
        <Section
          icon="monitor"
          title="Shop page · Header"
          note={place.shopHeroSetting ? undefined : '· automatic'}
          products={place.shopHero.product ? [place.shopHero.product] : []}
          numbered={false}
          onOpen={onOpen}
          empty="No header product."
        />
      </div>
    </section>
  )
}
