import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { hasPermission, isStaffRole } from '@/lib/permissions'
import { useAuthStore } from '@/store/authStore'

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

  return useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => (await adminApi.dashboard()).data.data,
    refetchInterval: 20_000,
    enabled,
  })
}
