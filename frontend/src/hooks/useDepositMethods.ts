import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'

/** Admin: your payment options (RIB, Cash Plus…), private — never in the public settings. */
export function useDepositMethods() {
  return useQuery({
    queryKey: ['admin-deposit-methods'],
    queryFn: async () => (await adminApi.depositMethods.get()).data.data,
    staleTime: 60_000,
  })
}
