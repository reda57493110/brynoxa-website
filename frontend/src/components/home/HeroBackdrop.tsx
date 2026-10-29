/**
 * Home hero background: a real computer setup that says what the shop sells at first sight, shown
 * sharp; only the headline side gets a fade so the text stays readable, and the bottom blends into
 * the section. Free Pexels photos, one per theme:
 * - dark mode: a monitor, keyboard and glowing PC tower lit in teal;
 * - light mode: a bright desk setup (monitors, keyboard, PC tower with blue-lit fans) in a white room.
 *
 * Only the photo of the current theme is downloaded (a CSS background loads only when it applies).
 */

import type { CSSProperties } from 'react'

const layer = 'pointer-events-none absolute [backface-visibility:hidden]'

// Each photo sized for the screen: ~100 KB on phones (a band at the top), ~200-230 KB on computers
const pexels = (id: number, w: number) =>
  `url(https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}&h=${Math.round((w * 1240) / 2200)}&fit=crop)`
const DARK_PHOTO = 6942359
const LIGHT_PHOTO = 7238759
const HERO_PHOTOS = {
  '--hero-sm': pexels(DARK_PHOTO, 1200),
  '--hero-lg': pexels(DARK_PHOTO, 1920),
  '--hero-light-sm': pexels(LIGHT_PHOTO, 1200),
  '--hero-light-lg': pexels(LIGHT_PHOTO, 1920),
} as CSSProperties

export function HeroBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#eef2f5] dark:bg-[#05080b]" aria-hidden="true">
      <div
        className={`${layer} hero-showroom inset-0 bg-cover [background-image:var(--hero-light-sm)] lg:[background-image:var(--hero-light-lg)] dark:[background-image:var(--hero-sm)] dark:lg:[background-image:var(--hero-lg)]`}
        style={HERO_PHOTOS}
      />
      {/* Headline side: a fade so the text reads on the photo */}
      <div
        className={`${layer} inset-0 bg-[linear-gradient(95deg,rgb(245_247_249/0.97)_0%,rgb(245_247_249/0.88)_30%,rgb(245_247_249/0.4)_50%,transparent_64%)] max-lg:hidden rtl:-scale-x-100 dark:bg-[linear-gradient(95deg,rgb(5_8_11/0.96)_0%,rgb(5_8_11/0.85)_30%,rgb(5_8_11/0.35)_50%,transparent_64%)]`}
      />
      {/* Phones / tablets: the photo is a clear band at the top; it fades toward the headline and the deals */}
      <div
        className={`${layer} inset-x-0 top-0 h-[27rem] bg-[linear-gradient(180deg,rgb(245_247_249/0.2)_0%,rgb(245_247_249/0.05)_16%,rgb(245_247_249/0.65)_36%,rgb(245_247_249/0.85)_58%,var(--bg)_100%)] lg:hidden dark:bg-[linear-gradient(180deg,rgb(5_8_11/0.3)_0%,rgb(5_8_11/0)_22%,rgb(5_8_11/0.35)_50%,rgb(5_8_11/0.75)_72%,var(--bg)_100%)]`}
      />
      {/* Top: keeps the navigation bar calm; bottom: blends into the section */}
      <div className={`${layer} inset-x-0 top-0 h-28 bg-gradient-to-b from-[var(--bg)]/70 to-transparent`} />
      <div
        className={`${layer} inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[var(--bg)] via-[color-mix(in_srgb,var(--bg)_55%,transparent)] to-transparent sm:h-40`}
      />
    </div>
  )
}
