import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { InventoryNav } from '@/components/admin/inventory/InventoryNav'
import { InventorySettings } from '@/components/admin/InventorySettings'

/** Inventory → Settings: inspection of new deliveries, storage places and stock statuses
 * (moved here from Admin → Settings, next to the stock they are about). */
export function InventorySettingsPage() {
  const settings = useQuery({
    queryKey: ['admin-settings'],
    queryFn: async () => (await adminApi.settings.get()).data.data,
  })
  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <InventoryNav />
      <AdminHeader title="Inventory settings" description="Checking new deliveries, storage places and stock statuses." />
      {settings.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : settings.isError ? (
        <QueryErrorState onRetry={() => settings.refetch()} />
      ) : (
        <InventorySettings settings={settings.data} />
      )}
    </div>
  )
}
