import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'
import { useT } from '@/hooks/useT'
import { useImageLoaded } from '@/hooks/useImageLoaded'
import { SafeImage } from './SafeImage'
import { SiteIcon } from './SiteIcon'

/**
 * Loading indicator laid over an image frame while the photo downloads: a soft brand-tinted
 * shine sweeping across the frame and a spinning brand ring around a product icon.
 * `tone="dark"` for frames on dark surfaces (e.g. the home spotlight).
 */
export function ImageSpinner({
  size = 'lg',
  tone = 'auto',
  className,
}: {
  size?: 'sm' | 'md' | 'lg'
  tone?: 'auto' | 'dark'
  className?: string
}) {
  const t = useT()
  const box = size === 'lg' ? 'h-16 w-16' : size === 'md' ? 'h-12 w-12' : 'h-9 w-9'
  const icon = size === 'lg' ? 22 : size === 'md' ? 17 : 13
  const ring = size === 'sm' ? 'border-2 inset-0.5' : 'border-[3px] inset-1'

  return (
    <div
      className={cn('pointer-events-none absolute inset-0 z-[1] flex items-center justify-center overflow-hidden', className)}
      role="status"
      aria-label={t('ui.loadingStatus')}
    >
      {/* Shine sweeping across the frame */}
      <div
        className="absolute inset-y-0 start-0 w-2/3 -translate-x-full bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--brand)_14%,transparent)] to-transparent motion-safe:animate-[image-shimmer_1.6s_ease-in-out_infinite] rtl:translate-x-full"
        aria-hidden="true"
      />
      <span
        className={cn(
          'relative flex items-center justify-center rounded-full shadow-soft backdrop-blur-sm',
          tone === 'dark' ? 'bg-[#0b1116]/80 ring-1 ring-white/10' : 'bg-[var(--bg-elevated)]/90 ring-1 ring-[var(--border)]',
          box
        )}
      >
        {/* Track + spinning arc in the brand colour */}
        <span className={cn('absolute rounded-full border-[color-mix(in_srgb,var(--brand)_18%,transparent)]', ring)} />
        <span
          className={cn(
            'absolute animate-spin rounded-full border-transparent border-t-[var(--brand)] border-e-[color-mix(in_srgb,var(--brand)_55%,transparent)] [animation-duration:0.85s] drop-shadow-[0_0_6px_rgb(0_194_255/0.55)]',
            ring
          )}
        />
        <SiteIcon name="package" size={icon} className="text-[var(--brand)] motion-safe:animate-pulse" />
      </span>
    </div>
  )
}

/**
 * Image in a frame that shows ImageSpinner until the photo has loaded, then fades the photo in.
 * `frameClassName` styles the frame (size, background, rounding); the rest goes to the image.
 */
export function LoadingImage({
  frameClassName,
  className,
  spinnerSize = 'md',
  ...img
}: ComponentProps<typeof SafeImage> & { frameClassName?: string; spinnerSize?: 'sm' | 'md' | 'lg' }) {
  const photo = useImageLoaded(typeof img.src === 'string' ? img.src : undefined)
  return (
    <div ref={photo.ref} className={cn('relative overflow-hidden', frameClassName)}>
      {photo.loaded ? null : <ImageSpinner size={spinnerSize} />}
      <SafeImage
        {...img}
        onLoad={photo.onLoad}
        onError={photo.onError}
        className={cn('transition-opacity duration-500', photo.loaded ? 'opacity-100' : 'opacity-0', className)}
      />
    </div>
  )
}
