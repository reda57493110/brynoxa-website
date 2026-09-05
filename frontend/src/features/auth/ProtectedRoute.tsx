import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { isStaffRole, staffHomePath } from '@/lib/permissions'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui/Spinner'

/** Customer account area — staff are sent to /admin instead. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const bootstrapped = useAuthStore((s) => s.bootstrapped)
  const isAuth = useAuthStore((s) => s.isAuthenticated())
  const role = useAuthStore((s) => s.user?.role)
  const location = useLocation()

  if (!bootstrapped) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!isAuth) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // Owner/staff manage the store in /admin — not the customer account pages.
  if (isStaffRole(role) && location.pathname.startsWith('/account')) {
    return <Navigate to={staffHomePath(role)} replace />
  }

  return children
}
