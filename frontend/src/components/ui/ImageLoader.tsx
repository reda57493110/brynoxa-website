import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

/**
 * Tracks whether the image inside `ref` has finished loading (or failed).
 * Spread `onLoad`/`onError` on the image and put `ref` on its frame.
 */
export function useImageLoaded<T extends HTMLElement = HTMLDivElement>(src?: string) {
  const ref = useRef<T>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(Boolean(ref.current?.querySelector('img')?.complete))
  }, [src])

  const done = useCallback(() => setLoaded(true), [])
  return { ref, loaded, onLoad: done, onError: done }
}

/** Spinner centered over an image frame while the photo downloads. */
export function ImageSpinner({ size = 'lg', className }: { size?: 'md' | 'lg'; className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 flex items-center justify-center', className)}>
      <span
        className={cn(
          'flex items-center justify-center rounded-full bg-[var(--bg-elevated)]/80 shadow-soft backdrop-blur-sm dark:bg-black/40',
          size === 'lg' ? 'h-14 w-14' : 'h-10 w-10'
        )}
      >
        <Spinner size={size} />
      </span>
    </div>
  )
}
