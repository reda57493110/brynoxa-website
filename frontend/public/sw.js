/* Brynoxa service worker — web push only (no offline caching). */

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'Brynoxa'
  const options = {
    body: data.body || '',
    icon: '/brand/icon-192.png',
    dir: data.dir || 'auto',
    data: { url: data.url || '/', campaignId: data.campaignId || null },
  }
  if (data.lang) options.lang = data.lang
  if (data.image) options.image = data.image
  if (data.tag) {
    options.tag = data.tag
    options.renotify = true
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  let target
  try {
    target = new URL(event.notification.data?.url || '/', self.location.origin)
  } catch {
    target = new URL('/', self.location.origin)
  }
  // Only ever open pages on this site.
  if (target.origin !== self.location.origin) target = new URL('/', self.location.origin)

  const campaignId = event.notification.data?.campaignId
  const recordClick = campaignId
    ? fetch('/api/v1/push/click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
        keepalive: true,
      }).catch(() => undefined)
    : Promise.resolve()

  const openSite = (async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue
      try {
        const navigated = await client.navigate(target.href)
        return (navigated || client).focus()
      } catch {
        return client.focus()
      }
    }
    return self.clients.openWindow(target.href)
  })()

  event.waitUntil(Promise.all([openSite, recordClick]))
})
