/**
 * Home hero background: a real computer setup that says what the shop sells at first sight — a
 * monitor, keyboard and glowing PC tower lit in teal (free Pexels photo).
 *
 * Dark mode: the photo fills the header, sharp; only the headline side gets a fade so the text
 * stays readable. Light mode: the page stays white and the same photo sits in a large rounded
 * "showroom window" on the deals side (see `.hero-window` in index.css).
 */

const layer = 'pointer-events-none absolute [backface-visibility:hidden]'

const HERO_PHOTO =
  'url(https://images.pexels.com/photos/6942359/pexels-photo-6942359.jpeg?auto=compress&cs=tinysrgb&w=2200&h=1240&fit=crop)'

export function HeroBackdrop() {
  return (
    <div
      className="absolute inset-0 overflow-hidden bg-[radial-gradient(120%_90%_at_15%_10%,#ffffff_0%,#f3f6fa_55%,#eaf0f6_100%)] dark:bg-none dark:bg-[#05080b]"
      aria-hidden="true"
    >
      {/* Dark mode: full header photo, faded on the headline side */}
      <div className={`${layer} hero-showroom inset-0 hidden bg-cover dark:block`} style={{ backgroundImage: HERO_PHOTO }} />
      <div
        className={`${layer} inset-0 hidden bg-[linear-gradient(95deg,rgb(5_8_11/0.96)_0%,rgb(5_8_11/0.85)_30%,rgb(5_8_11/0.35)_50%,transparent_64%)] rtl:-scale-x-100 dark:block`}
      />
      <div className={`${layer} inset-x-0 top-0 hidden h-28 bg-gradient-to-b from-[var(--bg)]/70 to-transparent dark:block`} />

      {/* Bottom: blends into the page (under the light-mode window) */}
      <div
        className={`${layer} inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[var(--bg)] via-[color-mix(in_srgb,var(--bg)_55%,transparent)] to-transparent sm:h-40`}
      />

      {/* Light mode: soft brand light, then the same photo in a showroom window on the deals side */}
      <div
        className={`${layer} -end-[8%] top-[2%] h-[96%] w-[68%] bg-[radial-gradient(closest-side,rgb(0_170_230/0.18),transparent_75%)] dark:hidden`}
      />
      <div className={`${layer} hero-window overflow-hidden dark:hidden`}>
        <div className="absolute inset-0 bg-cover bg-[position:92%_45%]" style={{ backgroundImage: HERO_PHOTO }} />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(255_255_255/0.1),transparent_30%,rgb(0_0_0/0.2))]" />
      </div>
    </div>
  )
}
