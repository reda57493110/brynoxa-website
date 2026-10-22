/**
 * Home hero background: a real computer setup that says what the shop sells at first sight —
 * a teal-lit monitor + gaming PC in dark mode, a bright desk with a monitor and a white
 * gaming PC in light mode (free Pexels photos). Shown sharp; only the headline side gets a fade so
 * the text stays readable, and the bottom blends into the page.
 *
 * CSS backgrounds, so the photo for the other theme is not downloaded.
 */

const layer = 'pointer-events-none absolute [backface-visibility:hidden]'

const pexels = (id: number) =>
  `url(https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=2200&h=1240&fit=crop)`
const HERO_PHOTO_DARK = 6942359 // monitor, keyboard and glowing PC tower lit in teal
const HERO_PHOTO_LIGHT = 11382771 // bright desk: monitor and a white gaming PC tower

export function HeroBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#f6f8fb] dark:bg-[#05080b]" aria-hidden="true">
      <div
        className={`${layer} hero-showroom inset-0 bg-cover dark:hidden`}
        style={{ backgroundImage: pexels(HERO_PHOTO_LIGHT) }}
      />
      <div
        className={`${layer} hero-showroom inset-0 hidden bg-cover dark:block`}
        style={{ backgroundImage: pexels(HERO_PHOTO_DARK) }}
      />

      {/* Headline side: a soft fade so the text reads on the photo */}
      <div
        className={`${layer} inset-0 bg-[linear-gradient(95deg,rgb(248_250_252/0.97)_0%,rgb(248_250_252/0.88)_30%,rgb(248_250_252/0.35)_50%,transparent_64%)] rtl:-scale-x-100 dark:bg-[linear-gradient(95deg,rgb(5_8_11/0.96)_0%,rgb(5_8_11/0.85)_30%,rgb(5_8_11/0.35)_50%,transparent_64%)]`}
      />
      {/* Top: keeps the navigation bar calm; bottom: blends into the page */}
      <div className={`${layer} inset-x-0 top-0 h-28 bg-gradient-to-b from-[var(--bg)]/70 to-transparent`} />
      <div
        className={`${layer} inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[var(--bg)] via-[color-mix(in_srgb,var(--bg)_55%,transparent)] to-transparent sm:h-40`}
      />
    </div>
  )
}
