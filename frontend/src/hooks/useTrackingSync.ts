import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { settingsApi } from '@/api/settingsApi'
import { configureTracking } from '@/lib/analytics'

/**
 * Shop layout only (never admin): loads the Meta Pixel, TikTok Pixel and Google Analytics ids
 * saved in Admin → Settings → Tracking codes.
 */
export function useTrackingSync() {
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await settingsApi.get()).data.data,
    staleTime: 60_000,
  })
  const tracking = settings.data?.tracking
  useEffect(() => {
    if (tracking) configureTracking(tracking)
  }, [tracking])
}
