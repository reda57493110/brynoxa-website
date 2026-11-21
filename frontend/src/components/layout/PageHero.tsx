import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { PageBand } from './PageBand'

/**
 * The top of the shop's other pages (cart, checkout, compare, legal, order confirmation), in the
 * home / shop / setups look: the path Home › page, then the Brynoxa band (dark; white in light
 * mode) with the title, the line under it and the buttons. Same band as Services or Contact.
 */
export function PageHero({
  kicker,
  title,
  description,
  children,
  titleId = 'page-heading',
  crumb,
  className,
}: {
  /** Small heading above the title (leave it out when it would only repeat the title) */
  kicker?: ReactNode
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  titleId?: string
  /** The page's name in the path (the title when it is text) */
  crumb?: string
  className?: string
}) {
  // No small label above the title: it only repeated the page name (the title says it once)
  void kicker
  return (
    <div className={cn('pt-2 sm:pt-4', className)}>
      <PageBand crumbs={[{ label: crumb ?? (typeof title === 'string' ? title : '') }]} titleId={titleId} title={title} body={description}>
        {children}
      </PageBand>
    </div>
  )
}
