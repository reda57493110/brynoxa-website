export type ShippingSettingsLike = {
  shippingFlatRate: number
  freeShippingMin: number
  shippingByCity?: { city: string; rate: number }[]
}

function normalizeCity(city: string): string {
  return city
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/** Match checkout totals to backend resolveShippingFee. */
export function resolveShippingFee(
  settings: ShippingSettingsLike | undefined,
  city: string | undefined,
  subtotal: number
): number {
  if (!settings) return 0
  if (settings.freeShippingMin > 0 && subtotal >= settings.freeShippingMin) {
    return 0
  }

  const needle = city ? normalizeCity(city) : ''
  if (needle && settings.shippingByCity?.length) {
    const match = settings.shippingByCity.find((row) => normalizeCity(row.city) === needle)
    if (match) return Math.max(0, Number(match.rate) || 0)
  }

  return Math.max(0, Number(settings.shippingFlatRate) || 0)
}
