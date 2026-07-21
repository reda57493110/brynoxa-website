import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { Spinner } from '@/components/ui/Spinner'
import { ProtectedRoute } from './ProtectedRoute'

export function AdminRoute({ children }: { children: ReactNode }) {
  const bootstrapped = useAuthStore((s) => s.bootstrapped)
  const isAdmin = useAuthStore((s) => s.isAdmin())

  if (!bootstrapped) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <ProtectedRoute>
      {isAdmin ? children : <Navigate to="/" replace />}
    </ProtectedRoute>
  )
}
