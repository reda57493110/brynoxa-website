import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { initAnalytics, trackPageView } from '@/lib/analytics'
import { captureUtm } from '@/lib/adTracking'

/** Initializes GA4 (if configured) and sends page_view on route changes. */
export function AnalyticsListener() {
  const location = useLocation()

  useEffect(() => {
    initAnalytics()
  }, [])

  useEffect(() => {
    const path = `${location.pathname}${location.search}`
    trackPageView(path)
    // A tracking link of an ad / post (Admin → Ads & social media): remembered for the order
    if (!location.pathname.includes('/admin')) captureUtm(location.search)
  }, [location.pathname, location.search])

  return null
}
