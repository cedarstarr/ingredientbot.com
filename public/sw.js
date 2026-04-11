// Robot Food PWA Service Worker — F43
// Strategy: cache-first for saved recipes API, network-first for everything else

const CACHE_NAME = 'robot-food-v1'
const OFFLINE_URL = '/offline'

// Resources to precache on install
const PRECACHE_URLS = [
  '/',
  '/kitchen',
  '/saved',
  '/offline',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Precache shell pages — ignore failures for individual pages
      return Promise.allSettled(
        PRECACHE_URLS.map((url) => cache.add(url).catch(() => {}))
      )
    }).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    // Delete old caches from previous versions
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // Cache-first strategy for saved recipes API — enables offline viewing
  if (url.pathname === '/api/user/saved' || url.pathname.startsWith('/api/recipes/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request)
        try {
          const fresh = await fetch(request)
          if (fresh.ok) cache.put(request, fresh.clone())
          return fresh
        } catch {
          // Offline — return cached version if available
          return cached || new Response(
            JSON.stringify({ error: 'offline', recipes: [] }),
            { headers: { 'Content-Type': 'application/json' } }
          )
        }
      })
    )
    return
  }

  // Network-first for navigation — fall back to cached page or /offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(request)
        if (cached) return cached
        const offlinePage = await caches.match(OFFLINE_URL)
        return offlinePage || new Response('You are offline', { status: 503 })
      })
    )
    return
  }

  // Stale-while-revalidate for static assets (_next/static, fonts, images)
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|ico|webp|woff2?)$/)
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request)
        const fetchPromise = fetch(request).then((fresh) => {
          cache.put(request, fresh.clone())
          return fresh
        }).catch(() => cached)
        return cached || fetchPromise
      })
    )
  }
})
