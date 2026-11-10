/**
 * Where the track must stand so card i sits in its place: centred when only about one card fits
 * (phones), at the left edge otherwise. Offsets are negative (the track moves left).
 */
export function cardOffset(i: number, step: number, viewport: number, card: number) {
  const lead = viewport < card * 1.9 ? Math.max(0, (viewport - card) / 2) : 0
  return lead - i * step
}

/** The card nearest to the current offset */
export function nearestCard(offset: number, step: number, viewport: number, card: number) {
  if (step <= 0) return 0
  return Math.round((cardOffset(0, step, viewport, card) - offset) / step)
}
