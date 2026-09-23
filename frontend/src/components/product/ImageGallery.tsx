import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { ProductImage } from '@/types'
import { cn } from '@/lib/cn'
import { useT } from '@/hooks/useT'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { SafeImage } from '@/components/ui/SafeImage'
import { optimizedImageUrl } from '@/lib/image'

export function ImageGallery({ images, name }: { images: ProductImage[]; name: string }) {
  const t = useT()
  const reduceMotion = useReducedMotion()
  const list = images.length
    ? images
    : [{ url: 'https://placehold.co/800x800/1a2229/00C2FF?text=Brynoxa', alt: name }]
  const [active, setActive] = useState(0)
  const current = list[active] ?? list[0]

  const go = (next: number) => {
    setActive((next + list.length) % list.length)
  }

  // Keep active index valid if the image list changes
  useEffect(() => {
    if (active >= list.length) setActive(0)
  }, [list.length, active])

  return (
    <div className="space-y-2.5 sm:space-y-3">
      <div className="relative -mx-4 aspect-[4/5] max-h-[min(70svh,28rem)] overflow-hidden bg-[var(--bg-muted)] sm:mx-0 sm:aspect-square sm:max-h-none sm:rounded-[1.35rem] sm:border sm:border-[var(--border)]">
        <AnimatePresence mode="sync" initial={false}>
          <motion.div
            key={current.url}
            initial={reduceMotion ? false : { opacity: 0.35 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            <SafeImage
              src={optimizedImageUrl(current.url, 1200)}
              alt={current.alt || name}
              referrerPolicy="no-referrer"
              decoding="async"
              className="h-full w-full object-contain p-3 sm:object-cover sm:p-0"
            />
          </motion.div>
        </AnimatePresence>

        {list.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(active - 1)}
              className="absolute start-2 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)]/90 text-[var(--fg)] shadow-soft backdrop-blur-md transition hover:border-[var(--brand)] sm:start-3 sm:h-10 sm:w-10"
              aria-label={t('ui.previousPage')}
            >
              <SiteIcon name="chevron-left" size={18} />
            </button>
            <button
              type="button"
              onClick={() => go(active + 1)}
              className="absolute end-2 top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)]/90 text-[var(--fg)] shadow-soft backdrop-blur-md transition hover:border-[var(--brand)] sm:end-3 sm:h-10 sm:w-10"
              aria-label={t('ui.nextPage')}
            >
              <SiteIcon name="chevron-right" size={18} />
            </button>
            <div className="absolute inset-x-0 bottom-2 z-10 flex justify-center gap-1.5 sm:hidden">
              {list.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`${i + 1}`}
                  onClick={() => setActive(i)}
                  className={cn(
                    'h-1.5 rounded-full transition',
                    i === active ? 'w-4 bg-[var(--brand)]' : 'w-1.5 bg-[var(--fg)]/35'
                  )}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {list.length > 1 ? (
        <div
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
          role="listbox"
          aria-label={t('productPage.gallery')}
        >
          {list.map((img, i) => (
            <button
              key={`${img.url}-${i}`}
              type="button"
              role="option"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={cn(
                'h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-[var(--bg-muted)] transition duration-200 sm:h-16 sm:w-16',
                i === active
                  ? 'border-[var(--brand)] opacity-100'
                  : 'border-transparent opacity-60 hover:opacity-100'
              )}
            >
              <SafeImage
                src={optimizedImageUrl(img.url, 180)}
                alt={img.alt || `${name} ${i + 1}`}
                referrerPolicy="no-referrer"
                decoding="async"
                className="h-full w-full object-contain p-1 sm:object-cover sm:p-0"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
