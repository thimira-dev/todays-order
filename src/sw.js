// Custom service worker (vite-plugin-pwa injectManifest mode).
// Handles: precaching, SPA fallback, prompt-style updates, web push.
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'

// Precache all build assets — the manifest is injected here at build time
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// SPA fallback: serve index.html for all navigations
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// registerType: 'prompt' — the client calls updateSW(true) after user confirms,
// which posts SKIP_WAITING so the new worker activates
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// ── Web push ────────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { body: event.data?.text() }
  }

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Bakery Run', {
      body: data.body ?? '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: { url: data.url ?? '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        const existing = windowClients.find((c) =>
          c.url.startsWith(self.location.origin),
        )
        if (existing) {
          existing.focus()
          return existing.navigate(url)
        }
        return clients.openWindow(url)
      }),
  )
})
