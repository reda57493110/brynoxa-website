import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { ProductImage } from '@/types'
import { cn } from '@/lib/cn'
import { useT } from '@/hooks/useT'
import { SiteIcon } from '@/components/ui/SiteIcon'

export function ImageGallery({ images, name }: { images: ProductImage[]; name: string }) {
  const t = useT()
  const reduceMotion = useReducedMotion()
  const list = images.length
    ? images
    : [{ url: 'https://placehold.co/800x800/1a2229/00C2FF?text=Brynoxa', alt: name }]
  const [active, setActive] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const current = list[active] ?? list[0]

  useEffect(() => {
    setLoaded(false)
  }, [current.url])

  const go = (next: number) => {
    setActive((next + list.length) % list.length)
  }

  return (
    <div className="space-y-2.5 sm:space-y-3">
      <div className="relative -mx-4 aspect-square overflow-hidden bg-[var(--bg-muted)] sm:mx-0 sm:rounded-[1.35rem] sm:border sm:border-[var(--border)]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.img
            key={current.url}
            src={current.url}
            alt={current.alt || name}
            referrerPolicy="no-referrer"
            decoding="async"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: loaded ? 1 : 0 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onLoad={() => setLoaded(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </AnimatePresence>

        {list.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(active - 1)}
              className="absolute start-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)]/90 text-[var(--fg)] shadow-soft backdrop-blur-md transition hover:border-[var(--brand)] sm:inline-flex"
              aria-label={t('ui.previousPage')}
            >
              <SiteIcon name="chevron-left" size={18} />
            </button>
            <button
              type="button"
              onClick={() => go(active + 1)}
              className="absolute end-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)]/90 text-[var(--fg)] shadow-soft backdrop-blur-md transition hover:border-[var(--brand)] sm:inline-flex"
              aria-label={t('ui.nextPage')}
            >
              <SiteIcon name="chevron-right" size={18} />
            </button>
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
                'h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition duration-200 sm:h-16 sm:w-16',
                i === active
                  ? 'border-[var(--brand)] opacity-100'
                  : 'border-transparent opacity-60 hover:opacity-100'
              )}
            >
              <img
                src={img.url}
                alt={img.alt || `${name} ${i + 1}`}
                referrerPolicy="no-referrer"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
