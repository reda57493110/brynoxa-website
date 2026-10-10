import { useEffect, useRef, useState, type ImgHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { SiteIcon } from './SiteIcon'

interface SafeImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallback?: ReactNode
}

const RETRY_DELAY_MS = 1200

/** Same URL with a cache-busting parameter, so a retry is a real new request. */
function retryUrl(src: string) {
  return `${src}${src.includes('?') ? '&' : '?'}retry=1`
}

/**
 * <img> that never shows a broken-image icon. A failed load is retried once after a short pause
 * (uploaded photos come from a serverless function whose first request can time out on a cold
 * start), then falls back to a neutral placeholder.
 */
export function SafeImage({ alt, className, fallback, onError, onLoad, src, srcSet, ...props }: SafeImageProps) {
  const [attempt, setAttempt] = useState<0 | 1 | 'failed'>(0)
  const [waiting, setWaiting] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    setAttempt(0)
    setWaiting(false)
    return () => window.clearTimeout(timer.current)
  }, [src])

  if (attempt === 'failed' || !src) {
    return (
      <div
        className={cn('flex items-center justify-center bg-[var(--bg-muted)] text-[var(--fg-muted)]', className)}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
      >
        {fallback ?? <SiteIcon name="package" size={22} />}
      </div>
    )
  }

  if (waiting) {
    // Between the failed request and the retry: a quiet placeholder, never a broken icon
    return <div className={cn('animate-pulse bg-[var(--bg-muted)]', className)} aria-hidden="true" />
  }

  const highPriority = props.fetchPriority === 'high'

  return (
    <img
      {...props}
      src={attempt === 1 ? retryUrl(src) : src}
      // The retry uses the plain URL only; a broken srcset entry would be picked again
      srcSet={attempt === 1 ? undefined : srcSet}
      alt={alt}
      loading={props.loading ?? (highPriority ? 'eager' : 'lazy')}
      decoding={props.decoding ?? 'async'}
      className={className}
      onLoad={onLoad}
      onError={(event) => {
        if (attempt === 0) {
          setWaiting(true)
          timer.current = window.setTimeout(() => {
            setWaiting(false)
            setAttempt(1)
          }, RETRY_DELAY_MS)
          return
        }
        setAttempt('failed')
        onError?.(event)
      }}
    />
  )
}
