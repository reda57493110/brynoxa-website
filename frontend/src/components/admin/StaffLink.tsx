import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { canOpenAdminPath } from '@/lib/permissions'
import { useAuthStore } from '@/store/authStore'

/**
 * A link to another admin page, only for staff who can open it: for the others the same text
 * without a link (`fallback` replaces it, e.g. null to hide a button), instead of a link that
 * sends them back to their home page.
 */
export function StaffLink({
  to,
  className,
  children,
  fallback,
  fallbackClassName,
}: {
  to: string
  className?: string
  children: ReactNode
  fallback?: ReactNode
  fallbackClassName?: string
}) {
  const role = useAuthStore((s) => s.user?.role)
  if (canOpenAdminPath(role, to)) {
    return (
      <Link to={to} className={className}>
        {children}
      </Link>
    )
  }
  if (fallback !== undefined) return <>{fallback}</>
  return <span className={fallbackClassName}>{children}</span>
}
