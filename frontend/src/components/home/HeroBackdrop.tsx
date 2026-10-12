/**
 * Home hero background, drawn in code (no photo to download): a dark stage in the brand colours
 * with soft blue light, a perspective grid floor, a fine dot pattern and circuit traces with
 * small pulses of light. Same look in light and dark mode (the hero text is white); it fades
 * into the page colour at the bottom. All motion is off for reduced-motion visitors.
 */

// Circuit traces (viewBox 1440×900): top-left corner and right edge, away from the text and deals
const TRACES = [
  'M0 160 H180 L230 110 H420',
  'M0 230 H120 L170 280 H300 L340 240 H470',
  'M60 0 V60 L110 110 H250',
  'M1440 120 H1300 L1250 170 H1120',
  'M1440 640 H1330 L1280 590 H1180 L1140 630 H1040',
  'M1380 900 V820 L1330 770 H1210',
]

const NODES: [number, number][] = [
  [420, 110],
  [470, 240],
  [250, 110],
  [1120, 170],
  [1040, 630],
  [1210, 770],
  [230, 110],
  [1280, 590],
]

export function HeroBackdrop() {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#06090c]" aria-hidden="true">
      {/* Light: a large brand glow behind the deals (top end), a softer one under the headline */}
      <div className="absolute -end-[15%] -top-[25%] h-[85vh] w-[85vh] rounded-full bg-[radial-gradient(closest-side,rgb(0_194_255/0.42),rgb(0_194_255/0.12)_55%,transparent)] blur-2xl motion-safe:animate-[hero-glow-drift_16s_ease-in-out_infinite_alternate]" />
      <div className="absolute -bottom-[30%] -start-[10%] h-[70vh] w-[70vh] rounded-full bg-[radial-gradient(closest-side,rgb(122_223_255/0.24),transparent)] blur-2xl motion-safe:animate-[hero-glow-drift_20s_ease-in-out_infinite_alternate-reverse]" />
      <div className="absolute start-[30%] top-[10%] h-[40vh] w-[40vh] rounded-full bg-[radial-gradient(closest-side,rgb(12_74_110/0.45),transparent)] blur-3xl" />

      {/* Fine dot pattern, strongest at the top */}
      <div className="absolute inset-0 bg-[radial-gradient(rgb(122_223_255/0.22)_1px,transparent_1px)] [background-size:26px_26px] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />

      {/* Perspective grid floor */}
      <div className="absolute inset-x-[-50%] bottom-[6%] h-[50%] [perspective:520px]">
        <div className="absolute inset-0 origin-bottom bg-[linear-gradient(rgb(0_194_255/0.4)_1px,transparent_1px),linear-gradient(90deg,rgb(0_194_255/0.4)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:linear-gradient(to_top,black_25%,transparent_90%)] [transform:rotateX(62deg)] motion-safe:animate-[hero-grid-move_6s_linear_infinite]" />
      </div>
      {/* Horizon: a line and a band of light where the floor meets the sky */}
      <div className="absolute inset-x-0 bottom-[34%] h-40 translate-y-1/2 bg-[radial-gradient(ellipse_at_center,rgb(0_194_255/0.28),transparent_70%)] blur-xl" />
      <div className="absolute inset-x-0 bottom-[34%] h-px bg-gradient-to-r from-transparent via-[rgb(122_223_255/0.75)] to-transparent" />

      {/* Circuit traces with travelling pulses */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" fill="none">
        <g stroke="rgb(0 194 255 / 0.22)" strokeWidth="1.2">
          {TRACES.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <g stroke="rgb(122 223 255 / 0.9)" strokeWidth="2" strokeLinecap="round">
          {TRACES.map((d, i) => (
            <path
              key={`pulse-${d}`}
              d={d}
              strokeDasharray="36 900"
              className="motion-safe:animate-[hero-circuit-pulse_5s_linear_infinite] motion-reduce:hidden"
              style={{ animationDelay: `${i * -0.85}s` }}
            />
          ))}
        </g>
        <g fill="#06090c" stroke="rgb(0 194 255 / 0.6)" strokeWidth="1.5">
          {NODES.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="4" />
          ))}
        </g>
      </svg>

      {/* Keep the headline readable and blend into the page below */}
      <div className="absolute inset-0 bg-[linear-gradient(100deg,rgb(6_9_12/0.6)_0%,rgb(6_9_12/0.2)_40%,transparent_65%)] rtl:-scale-x-100" />
      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[var(--bg)] via-[color-mix(in_srgb,var(--bg)_55%,transparent)] to-transparent sm:h-28" />
    </div>
  )
}
