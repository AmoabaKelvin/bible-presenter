// FlowCast service worker — offline app shell + Bible API resilience.
// Strategy:
//   • navigations (HTML)        → network-first, fall back to cache, then /offline
//   • same-origin static assets → cache-first (Next hashes them, so immutable)
//   • bible-api.eightlabs.xyz   → stale-while-revalidate (chapters/search survive a drop)
//   • everything else           → not intercepted (YouTube, Spotify, Google OAuth, etc.)

const VERSION = "flowcast-v2"
const SHELL_CACHE = `${VERSION}-shell`
const ASSET_CACHE = `${VERSION}-assets`
const API_CACHE = `${VERSION}-bible-api`

const OFFLINE_URL = "/offline"
const BIBLE_API_HOST = "bible-api.eightlabs.xyz"
// Easton's (~1.2 MB) is precached for instant offline use. Webster's 1913 is
// ~22 MB, so rather than re-downloading it on every SW install we let it be
// cache-first at runtime (see isStaticAsset) — offline after the first lookup.
const PRECACHE = [OFFLINE_URL, "/bibles/kjv.json", "/dictionaries/eastons.json"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Add each entry individually so a missing asset (e.g. kjv.json before
      // the fetch script runs) doesn't fail the whole install.
      Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {}))),
    ),
  )
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith(VERSION))
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/dictionaries/") ||
    /\.(?:js|css|woff2?|png|jpg|jpeg|gif|svg|ico|webp|avif)$/.test(url.pathname)
  )
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone())
      return res
    })
    .catch(() => null)
  return cached || (await network) || Response.error()
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached
  const res = await fetch(request)
  if (res && res.ok) cache.put(request, res.clone())
  return res
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const res = await fetch(request)
    if (res && res.ok) cache.put(request, res.clone())
    return res
  } catch {
    const cached = await cache.match(request)
    if (cached) return cached
    return (await caches.match(OFFLINE_URL)) || Response.error()
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)

  if (url.hostname === BIBLE_API_HOST) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE))
    return
  }

  if (url.origin !== self.location.origin) return // leave third-party traffic alone

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL_CACHE))
    return
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE))
  }
})
