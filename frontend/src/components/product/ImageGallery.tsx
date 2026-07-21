import { useState } from 'react'
import type { ProductImage } from '@/types'
import { cn } from '@/lib/cn'

export function ImageGallery({ images, name }: { images: ProductImage[]; name: string }) {
  const list = images.length
    ? images
    : [{ url: 'https://placehold.co/800x800/1a2229/00C2FF?text=Brynoxa', alt: name }]
  const [active, setActive] = useState(0)
  const current = list[active] ?? list[0]

  return (
    <div className="space-y-3">
      <div className="aspect-square overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)]">
        <img
          src={current.url}
          alt={current.alt || name}
          className="h-full w-full object-cover transition duration-500"
        />
      </div>
      {list.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {list.map((img, i) => (
            <button
              key={`${img.url}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                'h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition',
                i === active ? 'border-[var(--brand)]' : 'border-transparent opacity-70 hover:opacity-100'
              )}
            >
              <img src={img.url} alt={img.alt || `${name} ${i + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
