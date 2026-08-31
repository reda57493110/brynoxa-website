/**
 * Ask Cloudinary for an appropriately sized, automatically optimized image.
 * Other URLs (including local development data URLs) are returned unchanged.
 */
export function optimizedImageUrl(url: string | undefined, width: number) {
  if (!url || !url.includes('res.cloudinary.com')) return url
  return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`)
}
