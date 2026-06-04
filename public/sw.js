const CACHE = "dourak-v1"

const STATIC_URLS = [
  "/",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      return cache.addAll(STATIC_URLS)
    }),
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
      )
    }),
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (url.protocol === "ws:" || url.protocol === "wss:") {
    return
  }

  if (url.hostname.endsWith(".supabase.co")) {
    event.respondWith(fetch(request))
    return
  }

  if (request.method !== "GET") {
    event.respondWith(fetch(request))
    return
  }

  const isStatic =
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "font" ||
    request.destination === "image" ||
    STATIC_URLS.includes(url.pathname)

  if (isStatic) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (response.ok) {
            caches.open(CACHE).then((cache) => cache.put(request, response.clone()))
          }
          return response
        })
        return cached || fetchPromise
      }),
    )
  } else {
    event.respondWith(fetch(request))
  }
})
