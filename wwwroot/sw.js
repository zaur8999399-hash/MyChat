// sw.js — сеть first + push-уведомления
self.addEventListener('install', () => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});

// ===== PUSH-УВЕДОМЛЕНИЯ =====
self.addEventListener('push', (event) => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch (e) {}
    
    const title = data.title || 'Dove';
    const options = {
        body: data.body || 'Новое сообщение',
        icon: '/icon.png',
        badge: '/icon.png',
        tag: data.tag || 'dove-notification',
        data: { url: '/' },
        vibrate: [200, 100, 200]
    };
    
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((list) => {
                for (const client of list) {
                    if ('focus' in client) return client.focus();
                }
                return clients.openWindow(event.notification.data?.url || '/');
            })
    );
});