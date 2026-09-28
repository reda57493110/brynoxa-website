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
    data: { url: data.url || '/' },
  }
  if (data.image) options.image = data.image

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

  event.waitUntil(
    (async () => {
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
  )
})
