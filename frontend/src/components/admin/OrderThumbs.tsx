import { SafeImage } from '@/components/ui/SafeImage'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { imageFit, sizedImageUrl } from '@/lib/image'
import { cn } from '@/lib/cn'
import type { OrderItem } from '@/types'

/** One product photo (the photo saved on the order line), or a neutral icon when there is none. */
export function OrderItemThumb({ item, size = 'md', className }: { item: Pick<OrderItem, 'image' | 'name'>; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const box = size === 'sm' ? 'h-10 w-10' : size === 'lg' ? 'h-14 w-14' : 'h-10 w-10'
  const contain = imageFit(item.image) === 'contain'
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border)]',
        contain ? 'bg-white' : 'bg-[var(--bg-muted)]',
        box,
        className
      )}
      title={item.name}
    >
      {item.image ? (
        <SafeImage
          src={sizedImageUrl(item.image, size === 'lg' ? 160 : 96)}
          alt={item.name}
          referrerPolicy="no-referrer"
          className={cn('h-full w-full', contain ? 'object-contain p-0.5' : 'object-cover')}
          fallback={<SiteIcon name="package" size={14} />}
        />
      ) : (
        <SiteIcon name="package" size={14} className="text-[var(--fg-muted)]" />
      )}
    </span>
  )
}

/** Thumbnails of an order's products side by side, "+N" when there are more. */
export function OrderThumbs({ items, max = 3, size = 'md' }: { items: OrderItem[]; max?: number; size?: 'sm' | 'md' }) {
  const shown = items.slice(0, max)
  const more = items.length - shown.length
  return (
    <span className="inline-flex items-center gap-1" aria-label={items.map((i) => `${i.qty} × ${i.name}`).join(', ')}>
      {shown.map((item, i) => (
        <OrderItemThumb key={i} item={item} size={size} />
      ))}
      {more > 0 ? (
        <span
          className={cn(
            'inline-flex shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] text-[11px] font-semibold',
            size === 'sm' ? 'h-10 w-8' : 'h-10 w-9'
          )}
        >
          +{more}
        </span>
      ) : null}
    </span>
  )
}
