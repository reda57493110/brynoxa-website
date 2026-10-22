/**
 * Home hero background: a real desk photo for each theme (light desk / blue-lit desk), shown on
 * the deal-card side and faded out before the headline (see `.hero-photo` in index.css), with a
 * soft brand glow and fades that keep the text readable and blend into the page below.
 *
 * The photos are CSS backgrounds, so the one for the other theme is not downloaded.
 */

const layer = 'pointer-events-none absolute [backface-visibility:hidden]'

// Free Pexels photos
const pexels = (id: number) =>
  `url(https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1100&fit=crop)`
const HERO_PHOTO_DARK = 777001 // dual monitors on a desk lit in blue
const HERO_PHOTO_LIGHT = 3042508 // bright white desk with a monitor and plants

export function HeroBackdrop() {
  return (
    <div
      className="absolute inset-0 overflow-hidden bg-[linear-gradient(180deg,#fbfcfe_0%,#f2f5f9_62%,#f6f8fb_100%)] dark:bg-none dark:bg-[#06090c]"
      aria-hidden="true"
    >
      {/* The photo: light desk in light mode, blue-lit desk in dark mode */}
      <div
        className={`${layer} hero-photo inset-0 bg-cover bg-center dark:hidden`}
        style={{ backgroundImage: pexels(HERO_PHOTO_LIGHT) }}
      />
      <div
        className={`${layer} hero-photo inset-0 hidden bg-cover bg-center dark:block`}
        style={{ backgroundImage: pexels(HERO_PHOTO_DARK) }}
      />

      {/* Brand glow behind the deals */}
      <div
        className={`${layer} -end-[15%] -top-[25%] h-[95vh] w-[95vh] rounded-full bg-[radial-gradient(closest-side,rgb(0_170_230/0.14),transparent_70%)] dark:bg-[radial-gradient(closest-side,rgb(0_194_255/0.28),transparent_72%)]`}
      />

      {/* Keep the headline readable and blend into the page below */}
      <div
        className={`${layer} inset-0 bg-[linear-gradient(100deg,rgb(251_252_254/0.92)_0%,rgb(251_252_254/0.55)_38%,transparent_62%)] rtl:-scale-x-100 dark:bg-[linear-gradient(100deg,rgb(6_9_12/0.9)_0%,rgb(6_9_12/0.5)_38%,transparent_62%)]`}
      />
      <div
        className={`${layer} inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[var(--bg)] via-[color-mix(in_srgb,var(--bg)_55%,transparent)] to-transparent sm:h-36`}
      />
    </div>
  )
}
