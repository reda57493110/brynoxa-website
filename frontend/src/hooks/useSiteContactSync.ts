import { useQuery } from '@tanstack/react-query'
import { settingsApi } from '@/api/settingsApi'
import { applySiteSettings } from '@/lib/site'

/**
 * Layouts: the shop's contact details (WhatsApp, phone, email, social pages, legal details) from
 * Admin → Settings → Contact & business. Applied while rendering, so every page drawn in the same
 * pass already shows the saved numbers; remembered on the device for the next visit.
 */
export function useSiteContactSync() {
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await settingsApi.get()).data.data,
    staleTime: 60_000,
  })
  applySiteSettings(settings.data)
}
