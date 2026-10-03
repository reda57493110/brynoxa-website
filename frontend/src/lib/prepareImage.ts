const MAX_SIDE = 1600
const UPLOAD_LIMIT = 3.5 * 1024 * 1024
const SERVER_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('unreadable'))
    }
    img.src = url
  })
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

/**
 * Makes a photo from the phone gallery safe to upload: converts formats the server
 * refuses (HEIC…) to JPEG and shrinks big photos to at most 1600px / ~3.5 MB.
 * Small JPG/PNG/WebP files are sent unchanged.
 */
export async function prepareImageForUpload(file: File): Promise<{ blob: Blob; filename: string }> {
  const accepted = SERVER_TYPES.includes(file.type)
  if (accepted && file.size <= UPLOAD_LIMIT) {
    const img = await loadImage(file).catch(() => null)
    if (!img || Math.max(img.naturalWidth, img.naturalHeight) <= MAX_SIDE * 1.5) {
      return { blob: file, filename: file.name }
    }
  }

  let img: HTMLImageElement
  try {
    img = await loadImage(file)
  } catch {
    throw new Error('This photo format is not supported. Please choose a JPG or PNG photo.')
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process this photo')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  for (const quality of [0.86, 0.75, 0.6]) {
    const blob = await toJpeg(canvas, quality)
    if (blob && blob.size <= UPLOAD_LIMIT) {
      const base = file.name.replace(/\.[^.]+$/, '') || 'photo'
      return { blob, filename: `${base}.jpg` }
    }
  }
  throw new Error('This photo is too large. Please choose a smaller one.')
}
