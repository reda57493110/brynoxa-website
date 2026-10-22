/**
 * Home hero background: a real computer setup that says what the shop sells at first sight — a
 * monitor, keyboard and glowing PC tower lit in teal (free Pexels photo), shown sharp; only the
 * headline side gets a fade so the text stays readable, and the bottom blends into the section.
 *
 * The hero section always uses the dark design (`dark` class on it in Home.tsx), in light mode too.
 */

const layer = 'pointer-events-none absolute [backface-visibility:hidden]'

const HERO_PHOTO =
  'url(https://images.pexels.com/photos/6942359/pexels-photo-6942359.jpeg?auto=compress&cs=tinysrgb&w=2200&h=1240&fit=crop)'

export function HeroBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#05080b]" aria-hidden="true">
      <div className={`${layer} hero-showroom inset-0 bg-cover`} style={{ backgroundImage: HERO_PHOTO }} />
      {/* Headline side: a fade so the text reads on the photo */}
      <div
        className={`${layer} inset-0 bg-[linear-gradient(95deg,rgb(5_8_11/0.96)_0%,rgb(5_8_11/0.85)_30%,rgb(5_8_11/0.35)_50%,transparent_64%)] max-lg:hidden rtl:-scale-x-100`}
      />
      {/* Phones / tablets: the photo is a clear band at the top; it darkens toward the headline and the deals */}
      <div
        className={`${layer} inset-x-0 top-0 h-[26rem] bg-[linear-gradient(180deg,rgb(5_8_11/0.3)_0%,rgb(5_8_11/0)_25%,rgb(5_8_11/0.55)_55%,var(--bg)_100%)] lg:hidden`}
      />
      {/* Top: keeps the navigation bar calm; bottom: blends into the section */}
      <div className={`${layer} inset-x-0 top-0 h-28 bg-gradient-to-b from-[var(--bg)]/70 to-transparent`} />
      <div
        className={`${layer} inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[var(--bg)] via-[color-mix(in_srgb,var(--bg)_55%,transparent)] to-transparent sm:h-40`}
      />
    </div>
  )
}
