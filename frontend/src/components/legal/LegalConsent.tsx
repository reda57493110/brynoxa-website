import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { useT } from '@/hooks/useT'
import { cn } from '@/lib/cn'

const linkClass = 'font-medium text-[var(--brand-text)] underline-offset-2 hover:underline'

/** "By … you accept our Terms of Sale and Privacy Policy", with both titles linked. */
export function LegalConsent({
  action,
  className,
}: {
  action: 'order' | 'register'
  className?: string
}) {
  const t = useT()
  const template = t(action === 'order' ? 'legal.agreeOrder' : 'legal.agreeRegister')
  const links: Record<string, { to: string; label: string }> = {
    '{terms}': { to: '/terms', label: t('legal.termsTitle') },
    '{privacy}': { to: '/privacy', label: t('legal.privacyTitle') },
  }

  return (
    <p className={cn('text-xs leading-relaxed text-[var(--fg-muted)]', className)}>
      {template.split(/(\{terms\}|\{privacy\})/).map((part, i) => {
        const link = links[part]
        return link ? (
          <Link key={i} to={link.to} target="_blank" className={linkClass}>
            {link.label}
          </Link>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      })}
    </p>
  )
}
