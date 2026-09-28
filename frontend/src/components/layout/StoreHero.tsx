import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Container } from '@/components/ui/Container'
import { SafeImage } from '@/components/ui/SafeImage'
import { cn } from '@/lib/cn'

/** Secondary pill that reads on the dark photo in both themes. */
export const heroGhostPill =
  'inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 text-sm font-medium text-white backdrop-blur-sm transition hover:border-[var(--brand)] hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:h-12 sm:w-auto sm:text-base'

export const heroPrimaryPill =
  'inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-6 text-sm font-semibold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:h-12 sm:w-auto sm:text-base'

export const heroChip =
  'inline-flex h-8 items-center gap-1.5 rounded-full border border-white/15 bg-black/30 px-2.5 text-[11px] font-medium text-white backdrop-blur-sm sm:h-9 sm:gap-2 sm:px-3 sm:text-sm'

const fadeUp = (reduce: boolean | null, delay = 0) =>
  reduce
    ? { initial: false as const, animate: { opacity: 1 }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, y: 18 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] as const },
      }

export function StoreHero({
  kicker,
  titleLead,
  titleAccent,
  description,
  image,
  imagePosition = 'object-center',
  titleId = 'page-heading',
  containerClassName,
  children,
}: {
  kicker: string
  titleLead: ReactNode
  titleAccent?: ReactNode
  description?: ReactNode
  image: string
  imagePosition?: string
  titleId?: string
  containerClassName?: string
  children?: ReactNode
}) {
  const reduceMotion = useReducedMotion()

  return (
    <section
      aria-labelledby={titleId}
      className="relative -mt-[var(--nav-height)] flex min-h-[23rem] w-full flex-col overflow-hidden bg-[#080b0e] sm:min-h-[28rem] lg:min-h-[32rem]"
    >
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
        <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(8,11,14,0.95)_0%,rgba(8,11,14,0.8)_45%,rgba(8,11,14,0.45)_100%)] rtl:-scale-x-100" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[var(--bg)] to-transparent" />
      </div>

      <Container
        className={cn(
          'relative z-10 flex flex-1 flex-col justify-center pb-10 pt-[calc(var(--nav-height)+1.75rem)] sm:pb-14',
          containerClassName
        )}
      >
        <motion.p {...fadeUp(reduceMotion, 0)} className="kicker text-[var(--brand)] sm:text-sm">
          {kicker}
        </motion.p>

        <motion.h1
          id={titleId}
          {...fadeUp(reduceMotion, 0.08)}
          className="mt-3 max-w-3xl font-display text-3xl font-semibold tracking-tight text-balance text-white sm:mt-4 sm:text-5xl md:text-6xl"
        >
          {titleLead}
          {titleAccent ? <span className="block text-[var(--brand)]">{titleAccent}</span> : null}
        </motion.h1>

        {description ? (
          <motion.div
            {...fadeUp(reduceMotion, 0.16)}
            className="mt-3 max-w-xl text-[13px] leading-relaxed text-white/80 sm:mt-5 sm:text-lg"
          >
            {description}
          </motion.div>
        ) : null}

        {children ? (
          <motion.div {...fadeUp(reduceMotion, 0.24)} className="mt-6 sm:mt-8">
            {children}
          </motion.div>
        ) : null}
      </Container>
    </section>
  )
}
