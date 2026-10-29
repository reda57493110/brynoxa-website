import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { hasPermission, isStaffRole } from '@/lib/permissions'
import { useAuthStore } from '@/store/authStore'
import { savedPlaceholder, useKeepSavedCopy } from '@/lib/savedCopy'

/** Badge / dashboard stats — any staff role that needs counts in the shell. */
export function useAdminStats() {
  const role = useAuthStore((s) => s.user?.role)
  const enabled =
    isStaffRole(role) &&
    (hasPermission(role, 'dashboard') ||
      hasPermission(role, 'orders:read') ||
      hasPermission(role, 'inventory:write') ||
      hasPermission(role, 'messages') ||
      hasPermission(role, 'coupons') ||
      hasPermission(role, 'reviews'))

  const query = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => (await adminApi.dashboard()).data.data,
    staleTime: 60_000,
    refetchInterval: 90_000,
    enabled,
    // Last numbers seen on this device show at once while fresh ones load (lib/savedCopy.ts)
    placeholderData: savedPlaceholder('dashboard'),
  })
  useKeepSavedCopy('dashboard', query.data, query.isPlaceholderData)
  return query
}
