// Пустой service worker — ничего не кэширует, просто существует
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
// fetch не перехватываем — браузер сам ходит в сеть