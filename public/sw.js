/**
 * Minimal service worker for PWA installability and offline/update support.
 * Caches the app shell so the SW activates; optional fetch handler for static assets.
 */
const CACHE_NAME = "new-smell-v1"

self.addEventListener("install", (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(["/", "/manifest.webmanifest"])
    })
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match("/").then((r) => r || caches.match("/manifest.webmanifest"))
      )
    )
    return
  }
  event.respondWith(fetch(event.request))
})
