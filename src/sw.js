import { precacheAndRoute } from 'workbox-precaching'

precacheAndRoute(self.__WB_MANIFEST)

// Recebe notificações push do servidor
self.addEventListener('push', event => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Centavus', {
      body: data.body ?? '',
      icon: data.icon ?? '/logo.png',
      badge: data.badge ?? '/logo.png',
      data: { url: data.url ?? '/' },
      vibrate: [200, 100, 200],
    })
  )
})

// Ao clicar na notificação, abre o app na página correta
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin))
      if (existing) return existing.focus().then(c => c.navigate(url))
      return clients.openWindow(url)
    })
  )
})
