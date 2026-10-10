/**
 * Ask Cloudinary for an appropriately sized, automatically optimized image.
 * Other URLs (including local development data URLs) are returned unchanged.
 */
export function optimizedImageUrl(url: string | undefined, width: number) {
  if (!url || !url.includes('res.cloudinary.com')) return url
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`)
}

/** Like optimizedImageUrl, but also resizes Unsplash URLs (used by seeded products). */
export function sizedImageUrl(url: string | undefined, width: number) {
  if (!url || !url.includes('images.unsplash.com')) return optimizedImageUrl(url, width)
  try {
    const u = new URL(url)
    u.searchParams.set('w', String(width))
    u.searchParams.set('q', width <= 400 ? '60' : '80')
    u.searchParams.set('auto', 'format')
    return u.toString()
  } catch {
    return url
  }
}

/** Whether the host can serve the image at any width (Cloudinary, Unsplash). */
export function isResizableImage(url: string | undefined) {
  return Boolean(url && (url.includes('res.cloudinary.com') || url.includes('images.unsplash.com')))
}

/**
 * `srcset` with one entry per width, so the browser downloads the size the layout needs
 * (a 300 px card never pulls a 1200 px photo). Undefined for hosts that cannot resize.
 */
export function imageSrcSet(url: string | undefined, widths: number[]) {
  if (!isResizableImage(url)) return undefined
  return widths.map((w) => `${sizedImageUrl(url, w)} ${w}w`).join(', ')
}

/**
 * Lifestyle photos (stock photography) fill the frame; real product shots — usually on a white
 * background — are shown whole so nothing gets cropped.
 */
export function imageFit(url: string | undefined): 'cover' | 'contain' {
  return !url || url.includes('images.unsplash.com') ? 'cover' : 'contain'
}
