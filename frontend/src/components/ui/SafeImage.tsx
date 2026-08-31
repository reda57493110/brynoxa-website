import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { SiteIcon } from './SiteIcon'

interface SafeImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallback?: ReactNode
}

export function SafeImage({ alt, className, fallback, onError, src, ...props }: SafeImageProps) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  if (failed || !src) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-[var(--bg-muted)] text-[var(--fg-muted)]',
          className
        )}
        role={alt ? 'img' : undefined}
        aria-label={alt || undefined}
      >
        {fallback ?? <SiteIcon name="package" size={22} />}
      </div>
    )
  }

  return (
    <img
      {...props}
      src={src}
      alt={alt}
      loading={props.loading ?? 'lazy'}
      decoding={props.decoding ?? 'async'}
      className={className}
      onError={(event) => {
        setFailed(true)
        onError?.(event)
      }}
    />
  )
}
