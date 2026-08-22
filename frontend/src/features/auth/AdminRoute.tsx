import type { ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { isStaffRole } from '@/lib/permissions'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { useT } from '@/hooks/useT'

export function AdminRoute({ children }: { children: ReactNode }) {
  const t = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const bootstrapped = useAuthStore((s) => s.bootstrapped)
  const isAuth = useAuthStore((s) => Boolean(s.accessToken && s.user))
  const role = useAuthStore((s) => s.user?.role)

  if (!bootstrapped) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!isAuth) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!isStaffRole(role)) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] px-4">
        <EmptyState
          icon="shield"
          title={t('auth.adminRequired')}
          description={t('auth.adminRequiredBody')}
          actionLabel={t('common.signIn')}
          onAction={() => navigate('/login', { state: { from: '/admin' } })}
        />
        <Link to="/" className="mt-4 text-sm font-medium text-[var(--brand-text)] hover:underline">
          {t('common.home')}
        </Link>
      </div>
    )
  }

  return children
}
