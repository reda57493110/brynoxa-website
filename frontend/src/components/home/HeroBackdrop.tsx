/**
 * Home hero background, "speed of light": a photo of blue light streaks (free Pexels photo)
 * blended into the page — light on dark in dark mode, fine blue strokes on white in light mode
 * (see `.hero-streaks` in index.css) — with a soft brand glow behind the deals and fades that
 * keep the headline readable and blend into the page below.
 */

const layer = 'pointer-events-none absolute [backface-visibility:hidden]'

const STREAKS_PHOTO =
  'url(https://images.pexels.com/photos/28589369/pexels-photo-28589369.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1100&fit=crop)'

export function HeroBackdrop() {
  return (
    <div
      className="absolute inset-0 overflow-hidden bg-[linear-gradient(180deg,#fbfcfe_0%,#f2f5f9_62%,#f6f8fb_100%)] dark:bg-none dark:bg-[#05080b]"
      aria-hidden="true"
    >
      {/* Light streaks; a very slow drift (off for reduced-motion visitors) */}
      <div
        className={`${layer} hero-streaks -inset-[4%] bg-cover bg-center will-change-transform motion-safe:animate-[hero-streaks-drift_28s_ease-in-out_infinite_alternate]`}
        style={{ backgroundImage: STREAKS_PHOTO }}
      />

      {/* Brand glow behind the deals */}
      <div
        className={`${layer} -end-[15%] -top-[25%] h-[95vh] w-[95vh] rounded-full bg-[radial-gradient(closest-side,rgb(0_170_230/0.14),transparent_70%)] dark:bg-[radial-gradient(closest-side,rgb(0_194_255/0.28),transparent_72%)]`}
      />

      {/* Keep the headline readable and blend into the page below */}
      <div
        className={`${layer} inset-0 bg-[linear-gradient(100deg,rgb(251_252_254/0.94)_0%,rgb(251_252_254/0.6)_36%,transparent_60%)] rtl:-scale-x-100 dark:bg-[linear-gradient(100deg,rgb(6_9_12/0.92)_0%,rgb(6_9_12/0.55)_36%,transparent_60%)]`}
      />
      <div
        className={`${layer} inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[var(--bg)] via-[color-mix(in_srgb,var(--bg)_55%,transparent)] to-transparent sm:h-36`}
      />
    </div>
  )
}
