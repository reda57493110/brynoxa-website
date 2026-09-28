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
    u.searchParams.set('q', width <= 400 ? '50' : '85')
    u.searchParams.set('auto', 'format')
    return u.toString()
  } catch {
    return url
  }
}
