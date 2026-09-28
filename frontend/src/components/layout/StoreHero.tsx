import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Container } from '@/components/ui/Container'
import { SafeImage } from '@/components/ui/SafeImage'
import { cn } from '@/lib/cn'

/** Light card in light mode, glass on the photo in dark mode. */
export const heroGhostPill =
  'inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 text-sm font-medium text-[var(--fg)] transition hover:border-[var(--brand)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:h-11 sm:px-5 dark:border-white/20 dark:bg-white/10 dark:text-white dark:backdrop-blur-sm dark:hover:bg-white/15'

export const heroPrimaryPill =
  'inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-5 text-sm font-semibold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:h-11 sm:px-6'

export const heroChip =
  'inline-flex h-7 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)] px-2.5 text-[11px] font-medium text-[var(--fg-muted)] sm:h-8 sm:px-3 sm:text-xs dark:border-white/15 dark:bg-black/30 dark:text-white dark:backdrop-blur-sm'

export const heroInput =
  'h-10 min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--bg-input)] px-4 text-sm text-[var(--fg)] outline-none placeholder:text-[var(--fg-muted)] focus:border-[var(--brand)] sm:h-11 dark:border-white/20 dark:bg-white/10 dark:text-white dark:backdrop-blur-sm dark:placeholder:text-white/55'

const fadeUp = (reduce: boolean | null, delay = 0) =>
  reduce
    ? { initial: false as const, animate: { opacity: 1 }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
      }

export function StoreHero({
  kicker,
  titleLead,
  titleAccent,
  description,
  image,
  imagePosition = 'object-center',
  framePosition = 'object-center',
  titleId = 'page-heading',
  maxWidthClassName = 'max-w-7xl',
  children,
}: {
  kicker: string
  titleLead: ReactNode
  titleAccent?: ReactNode
  description?: ReactNode
  image: string
  /** Crop of the full-bleed dark-mode background. */
  imagePosition?: string
  /** Crop of the framed light-mode picture. */
  framePosition?: string
  titleId?: string
  /** Match the page's content width so the light-mode card lines up with it. */
  maxWidthClassName?: string
  children?: ReactNode
}) {
  const reduceMotion = useReducedMotion()

  return (
    <section
      aria-labelledby={titleId}
      className="relative -mt-[var(--nav-height)] w-full pt-[calc(var(--nav-height)+0.75rem)] dark:pt-0"
    >
      <div
        className={cn(
          'mx-auto px-4 sm:px-6 lg:px-8 dark:max-w-none dark:px-0',
          maxWidthClassName
        )}
      >
        <div className="relative overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-[var(--bg-elevated)] shadow-soft dark:rounded-none dark:border-0 dark:bg-[#080b0e] dark:shadow-none">
          <div
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_0%_0%,rgba(0,194,255,0.12),transparent_55%)] rtl:-scale-x-100 dark:hidden"
            aria-hidden="true"
          />

          <div className="absolute inset-0 hidden dark:block" aria-hidden="true">
            <SafeImage
              src={image}
              alt=""
              width={2560}
              height={1440}
              sizes="100vw"
              className={cn('absolute inset-0 h-full w-full max-w-none object-cover', imagePosition)}
              fetchPriority="high"
            />
            <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(8,11,14,0.95)_0%,rgba(8,11,14,0.8)_45%,rgba(8,11,14,0.45)_100%)] rtl:-scale-x-100" />
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[var(--bg)] to-transparent" />
          </div>

          <Container
            className={cn(
              'relative z-10 grid items-center gap-8 px-5 py-7 sm:px-8 sm:py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-10 lg:px-10 lg:py-8 dark:grid-cols-1!',
              'dark:px-4 dark:pb-8 dark:pt-[calc(var(--nav-height)+1.25rem)] sm:dark:px-6 sm:dark:pb-10 sm:dark:pt-[calc(var(--nav-height)+2rem)] lg:dark:px-8',
              maxWidthClassName
            )}
          >
            <div className="min-w-0">
              <motion.p
                {...fadeUp(reduceMotion, 0)}
                className="kicker text-[11px] text-[var(--brand-text)] sm:text-xs dark:text-[var(--brand)]"
              >
                {kicker}
              </motion.p>

              <motion.h1
                id={titleId}
                {...fadeUp(reduceMotion, 0.06)}
                className="mt-2 max-w-2xl font-display text-2xl font-semibold leading-tight tracking-tight text-balance text-[var(--fg)] sm:text-4xl md:text-[2.625rem] dark:text-white"
              >
                {titleLead}
                {titleAccent ? (
                  <span className="block text-[var(--brand-text)] dark:text-[var(--brand)]">{titleAccent}</span>
                ) : null}
              </motion.h1>

              {description ? (
                <motion.div
                  {...fadeUp(reduceMotion, 0.12)}
                  className="mt-2 max-w-lg text-[13px] leading-relaxed text-[var(--fg-muted)] sm:mt-3 sm:text-[15px] dark:text-white/75"
                >
                  {description}
                </motion.div>
              ) : null}

              {children ? (
                <motion.div {...fadeUp(reduceMotion, 0.18)} className="mt-4 sm:mt-5">
                  {children}
                </motion.div>
              ) : null}
            </div>

            <motion.div
              {...fadeUp(reduceMotion, 0.1)}
              className="relative hidden md:block dark:hidden!"
              aria-hidden="true"
            >
              <div className="absolute -inset-3 rounded-[1.75rem] bg-[radial-gradient(closest-side,rgba(0,194,255,0.22),transparent)]" />
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)] shadow-soft lg:aspect-[16/10]">
                <SafeImage
                  src={image}
                  alt=""
                  width={1600}
                  height={1000}
                  sizes="(min-width: 768px) 60vw, 0px"
                  className={cn('h-full w-full max-w-none object-cover', framePosition)}
                />
              </div>
            </motion.div>
          </Container>
        </div>
      </div>
    </section>
  )
}
