// Minimal service worker: makes the app installable as a PWA (standalone window).
// Deliberately no caching — notes always come from the server, so there's nothing stale to debug.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // Pass-through: let the browser handle every request normally.
});
