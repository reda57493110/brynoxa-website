import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Container } from '@/components/ui/Container'
import { SafeImage } from '@/components/ui/SafeImage'
import { cn } from '@/lib/cn'

/** Secondary pill that reads on the dark photo in both themes. */
export const heroGhostPill =
  'inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 text-sm font-medium text-white backdrop-blur-sm transition hover:border-[var(--brand)] hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:h-11 sm:px-5'

export const heroPrimaryPill =
  'inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-5 text-sm font-semibold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:h-11 sm:px-6'

export const heroChip =
  'inline-flex h-7 items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-2.5 text-[11px] font-medium text-white backdrop-blur-sm sm:h-8 sm:px-3 sm:text-xs'

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
  titleId = 'page-heading',
  maxWidthClassName = 'max-w-7xl',
  children,
}: {
  kicker: string
  titleLead: ReactNode
  titleAccent?: ReactNode
  description?: ReactNode
  image: string
  imagePosition?: string
  titleId?: string
  /** Match the page's content width so the light-mode banner lines up with it. */
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
        <div className="relative overflow-hidden rounded-[1.75rem] bg-[#080b0e] shadow-soft dark:rounded-none dark:shadow-none">
          <div className="absolute inset-0" aria-hidden="true">
            <SafeImage
              src={image}
              alt=""
              width={2560}
              height={1440}
              sizes="100vw"
              className={cn('absolute inset-0 h-full w-full max-w-none object-cover', imagePosition)}
              fetchPriority="high"
            />
            <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(8,11,14,0.92)_0%,rgba(8,11,14,0.72)_45%,rgba(8,11,14,0.3)_100%)] rtl:-scale-x-100 dark:bg-[linear-gradient(105deg,rgba(8,11,14,0.95)_0%,rgba(8,11,14,0.8)_45%,rgba(8,11,14,0.45)_100%)]" />
            <div className="absolute inset-x-0 bottom-0 hidden h-12 bg-gradient-to-t from-[var(--bg)] to-transparent dark:block" />
          </div>

          <Container
            className={cn(
              'relative z-10 px-6 py-8 sm:px-10 sm:py-11 lg:px-12',
              'dark:px-4 dark:pb-8 dark:pt-[calc(var(--nav-height)+1.25rem)] sm:dark:px-6 sm:dark:pb-10 sm:dark:pt-[calc(var(--nav-height)+2rem)] lg:dark:px-8',
              maxWidthClassName
            )}
          >
            <motion.p {...fadeUp(reduceMotion, 0)} className="kicker text-[11px] text-[var(--brand)] sm:text-xs">
              {kicker}
            </motion.p>

            <motion.h1
              id={titleId}
              {...fadeUp(reduceMotion, 0.06)}
              className="mt-2 max-w-2xl font-display text-2xl font-semibold leading-tight tracking-tight text-balance text-white sm:text-4xl md:text-[2.625rem]"
            >
              {titleLead}
              {titleAccent ? <span className="block text-[var(--brand)]">{titleAccent}</span> : null}
            </motion.h1>

            {description ? (
              <motion.div
                {...fadeUp(reduceMotion, 0.12)}
                className="mt-2 max-w-lg text-[13px] leading-relaxed text-white/75 sm:mt-3 sm:text-[15px]"
              >
                {description}
              </motion.div>
            ) : null}

            {children ? (
              <motion.div {...fadeUp(reduceMotion, 0.18)} className="mt-4 sm:mt-5">
                {children}
              </motion.div>
            ) : null}
          </Container>
        </div>
      </div>
    </section>
  )
}
