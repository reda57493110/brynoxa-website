import type { SiteIconName } from '@/components/ui/SiteIcon'
import { useT } from '@/hooks/useT'
import { formatSpecValue, getTemplate, resolveTemplate } from '@/lib/specs'
import { cn } from '@/lib/cn'
import { useCartStore } from '@/store/cartStore'
import { useLocaleStore } from '@/store/localeStore'
import { toast } from '@/store/toastStore'
import type { Category, Product } from '@/types'

function primaryImage(p: Product) {
  return p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url || undefined
}

const SPEC_ICON: Record<string, SiteIconName> = {
  cpu: 'cpu',
  ram_gb: 'layers',
  capacity_gb: 'layers',
  storage: 'boxes',
  gpu: 'gamepad',
  screen_size: 'monitor',
  resolution: 'monitor',
  refresh_rate: 'monitor',
}

/** Up to `max` headline specs (the template's important ones, in order), formatted for display. */
export function keySpecs(p: Product, locale: ReturnType<typeof useLocaleStore.getState>['locale'], max = 3) {
  const category = typeof p.category === 'object' ? (p.category as Category) : null
  const tpl = getTemplate(resolveTemplate(p.specTemplate, category))
  const specs = p.specs || {}
  return tpl.important
    .filter((k) => String(specs[k] ?? '').trim())
    .slice(0, max)
    .map((k) => ({ key: k, icon: SPEC_ICON[k] ?? 'sliders', value: formatSpecValue(k, String(specs[k]), locale) }))
}

export function useAddToCart(product: Product) {
  const addItem = useCartStore((s) => s.addItem)
  const t = useT()
  return () => {
    if (product.stock <= 0) {
      toast.error(t('product.outOfStock'))
      return
    }
    addItem({
      productId: product._id,
      slug: product.slug,
      name: product.variantLabel ? `${product.name} (${product.variantLabel})` : product.name,
      image: primaryImage(product),
      price: product.price,
      stock: product.stock,
      sku: product.sku,
      condition: product.condition,
    })
  }
}

export function deal(p: Product) {
  if (p.compareAtPrice == null || p.compareAtPrice <= p.price) return null
  return { percent: Math.round((1 - p.price / p.compareAtPrice) * 100), saved: p.compareAtPrice - p.price }
}

const isLow = (p: Product) => p.stock > 0 && p.stock <= (p.lowStockThreshold ?? 5)

/** "−14%" sticker in the brand colour. */
/**
 * Discount sticker: brand-blue gradient disc with "-11%" and a small "OFF" label, a crisp outline
 * (white in light mode, dark in dark mode) and a soft glow.
 * Uses a plain hyphen: the display font draws the true minus sign (−) like a tilde.
 */
export function DealSticker({ percent, className }: { percent: number; className?: string }) {
  const t = useT()
  return (
    <span
      className={cn(
        'relative inline-flex flex-col items-center justify-center rounded-full bg-[radial-gradient(circle_at_32%_26%,#9be8ff_0%,var(--brand)_48%,#0091c2_100%)] text-[var(--brand-fg)] shadow-[0_8px_20px_-8px_rgb(0_145_194/0.6)] ring-2 ring-white dark:ring-[#0b1116]',
        className
      )}
      aria-label={`-${percent}% ${t('home.offLabel')}`}
    >
      <span className="font-display font-extrabold leading-none tracking-tight" aria-hidden="true">
        <span className="font-sans">-</span>
        {percent}
        <span className="text-[0.7em]">%</span>
      </span>
      <span className="mt-0.5 text-[0.42em] font-bold uppercase leading-none tracking-[0.14em] opacity-80" aria-hidden="true">
        {t('home.offLabel')}
      </span>
    </span>
  )
}

/** Dot + "Only 3 left" / "In stock". */
export function StockLine({ product, className }: { product: Product; className?: string }) {
  const t = useT()
  const low = isLow(product)
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-medium', low ? 'text-[#ffc53d]' : 'text-[#3dd68c]', className)}>
      <span className="relative flex h-2 w-2">
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', low ? 'bg-[#ffc53d]' : 'bg-[#3dd68c]')} />
      </span>
      {low ? t('stock.onlyLeft', { count: product.stock }) : t('stock.inStock')}
    </span>
  )
}
