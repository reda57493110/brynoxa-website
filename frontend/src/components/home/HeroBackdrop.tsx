/**
 * Home hero background, drawn in code (no photo to download), in the brand colours:
 * soft blue light, a perspective grid floor with a glowing horizon, a fine dot pattern and
 * circuit traces with small pulses of light. Light and dark versions; fades into the page.
 *
 * Built to stay smooth: the glows are plain radial gradients (no blur filter) and every
 * animation only moves or fades layers (transform / opacity), which the GPU handles without
 * repainting. All motion is off for reduced-motion visitors.
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

const layer = 'pointer-events-none absolute [backface-visibility:hidden]'

export function HeroBackdrop() {
  return (
    <div
      className="absolute inset-0 overflow-hidden bg-[linear-gradient(180deg,#e9f5fb_0%,#f4f9fc_55%,#f7fafc_100%)] dark:bg-none dark:bg-[#06090c]"
      aria-hidden="true"
    >
      {/* Light: big brand glow behind the deals, a softer one under the headline (gradients, no blur) */}
      <div
        className={`${layer} -end-[18%] -top-[30%] h-[95vh] w-[95vh] rounded-full bg-[radial-gradient(closest-side,rgb(0_194_255/0.28),rgb(0_194_255/0.1)_45%,transparent_72%)] will-change-transform motion-safe:animate-[hero-glow-drift_18s_ease-in-out_infinite_alternate] dark:bg-[radial-gradient(closest-side,rgb(0_194_255/0.4),rgb(0_194_255/0.12)_45%,transparent_72%)]`}
      />
      <div
        className={`${layer} -bottom-[35%] -start-[12%] h-[80vh] w-[80vh] rounded-full bg-[radial-gradient(closest-side,rgb(0_150_210/0.16),transparent_70%)] will-change-transform motion-safe:animate-[hero-glow-drift-alt_22s_ease-in-out_infinite_alternate] dark:bg-[radial-gradient(closest-side,rgb(122_223_255/0.2),transparent_70%)]`}
      />
      <div
        className={`${layer} start-[25%] top-[5%] h-[50vh] w-[50vh] rounded-full bg-[radial-gradient(closest-side,rgb(0_119_168/0.08),transparent_70%)] dark:bg-[radial-gradient(closest-side,rgb(12_74_110/0.5),transparent_70%)]`}
      />

      {/* Fine dot pattern, strongest at the top */}
      <div
        className={`${layer} inset-0 bg-[radial-gradient(rgb(0_119_168/0.16)_1px,transparent_1px)] [background-size:26px_26px] [mask-image:linear-gradient(to_bottom,black,transparent_70%)] dark:bg-[radial-gradient(rgb(122_223_255/0.2)_1px,transparent_1px)]`}
      />

      {/* Perspective grid floor: the tilted plane is static; only its pattern layer slides (transform) */}
      <div
        className={`${layer} inset-x-[-50%] bottom-[6%] h-[50%] [mask-image:linear-gradient(to_top,black_20%,transparent_92%)] [perspective:520px]`}
      >
        <div className="absolute inset-0 origin-bottom overflow-hidden [transform:rotateX(62deg)]">
          <div className="absolute inset-x-0 -top-16 bottom-0 bg-[linear-gradient(rgb(0_119_168/0.3)_1px,transparent_1px),linear-gradient(90deg,rgb(0_119_168/0.3)_1px,transparent_1px)] [background-size:64px_64px] will-change-transform motion-safe:animate-[hero-grid-move_3.2s_linear_infinite] dark:bg-[linear-gradient(rgb(0_194_255/0.38)_1px,transparent_1px),linear-gradient(90deg,rgb(0_194_255/0.38)_1px,transparent_1px)]" />
        </div>
      </div>

      {/* Horizon: a band of light and a line where the floor meets the sky */}
      <div
        className={`${layer} inset-x-0 bottom-[34%] h-48 translate-y-1/2 bg-[radial-gradient(ellipse_50%_50%_at_center,rgb(0_194_255/0.18),transparent)] motion-safe:animate-[hero-horizon-breathe_6s_ease-in-out_infinite_alternate] dark:bg-[radial-gradient(ellipse_50%_50%_at_center,rgb(0_194_255/0.3),transparent)]`}
      />
      <div
        className={`${layer} inset-x-0 bottom-[34%] h-px bg-gradient-to-r from-transparent via-[rgb(0_119_168/0.55)] to-transparent dark:via-[rgb(122_223_255/0.75)]`}
      />

      {/* Circuit traces with travelling pulses */}
      <svg className={`${layer} inset-0 h-full w-full`} viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" fill="none">
        <g className="stroke-[rgb(0_119_168/0.22)] dark:stroke-[rgb(0_194_255/0.22)]" strokeWidth="1.2">
          {TRACES.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <g
          className="stroke-[rgb(0_150_210/0.85)] motion-reduce:hidden dark:stroke-[rgb(122_223_255/0.9)]"
          strokeWidth="2"
          strokeLinecap="round"
        >
          {TRACES.map((d, i) => (
            <path
              key={`pulse-${d}`}
              d={d}
              pathLength={1000}
              strokeDasharray="40 960"
              className="motion-safe:animate-[hero-circuit-pulse_7s_linear_infinite]"
              style={{ animationDelay: `${i * -1.15}s` }}
            />
          ))}
        </g>
        <g className="fill-[#eef6fb] stroke-[rgb(0_119_168/0.55)] dark:fill-[#06090c] dark:stroke-[rgb(0_194_255/0.6)]" strokeWidth="1.5">
          {NODES.map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="4" />
          ))}
        </g>
      </svg>

      {/* Keep the headline readable and blend into the page below */}
      <div
        className={`${layer} inset-0 bg-[linear-gradient(100deg,rgb(244_249_252/0.85)_0%,rgb(244_249_252/0.35)_40%,transparent_65%)] rtl:-scale-x-100 dark:bg-[linear-gradient(100deg,rgb(6_9_12/0.6)_0%,rgb(6_9_12/0.2)_40%,transparent_65%)]`}
      />
      <div
        className={`${layer} inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[var(--bg)] via-[color-mix(in_srgb,var(--bg)_55%,transparent)] to-transparent sm:h-28`}
      />
    </div>
  )
}
