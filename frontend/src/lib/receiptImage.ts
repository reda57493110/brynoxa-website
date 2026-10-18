/**
 * Turns a phone photo of a receipt into a small JPEG data URL (long side ≤ 1600px, under ~1 MB),
 * so it uploads fast on mobile data and stays well under the server limit.
 */
export async function receiptToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not-image')
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('not-image'))
      el.src = url
    })
    const max = 1600
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('not-image')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    let quality = 0.82
    let out = canvas.toDataURL('image/jpeg', quality)
    while (out.length > 1_300_000 && quality > 0.4) {
      quality -= 0.12
      out = canvas.toDataURL('image/jpeg', quality)
    }
    return out
  } finally {
    URL.revokeObjectURL(url)
  }
}
