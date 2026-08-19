import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => (await adminApi.dashboard()).data.data,
    refetchInterval: 20_000,
  })
}
